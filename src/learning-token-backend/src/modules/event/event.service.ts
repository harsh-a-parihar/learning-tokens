import { BadRequestException, HttpException, Injectable, Inject, forwardRef } from '@nestjs/common'
import { CreateScoringGuideDTO } from './dto/create-event.dto'
import { UpdateEventDto } from './dto/update-event.dto'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, In } from 'typeorm'
import { ScoringGuide } from './entities/scoring-guide.entity'
import { CreateEventDto } from './dto/create-scoring-guide.dto'
import { PinataSDK } from 'pinata'
import * as dotenv from 'dotenv'
import { OnlineEvent } from './entities/event.entity'
import * as fs from 'fs' // If you are working with files from the filesystem
import { Preevent, PreEventEnum } from '../preevent/entities/preevent.entity'
import { Instructor } from '../instructors/entities/instructor.entity'
import { SmartcontractService } from '../smartcontract/smartcontract.service'
import { Postevent } from '../postevent/entities/postevent.entity'
import { Learner } from '../learners/entities/learner.entity'
import { Institution } from '../institutions/entities/institution.entity'
dotenv.config()

@Injectable()
export class EventService {
    constructor(
        @InjectRepository(Preevent)
        private readonly preEventRepository: Repository<Preevent>,
        @InjectRepository(OnlineEvent)
        private readonly eventRepository: Repository<OnlineEvent>,
        @InjectRepository(ScoringGuide)
        private readonly scoringGuideRepository: Repository<ScoringGuide>,
        @InjectRepository(Postevent)
        private readonly posteventRepository: Repository<Postevent>,
        @InjectRepository(Learner)
        private readonly learnerRepository: Repository<Learner>,
        @InjectRepository(Institution)
        private readonly institutionRepository: Repository<Institution>,
        @Inject(forwardRef(() => SmartcontractService))
        private readonly smartcontractService: SmartcontractService
    ) {}
    create(createEventDto: CreateEventDto) {
        try {
            const event = this.eventRepository.create(createEventDto)

            return this.eventRepository.save(event)
        } catch (error) {
            throw new HttpException('Something went wrongs', 400, {
                cause: new Error('Some Error')
            })
        }
    }

    async createScoringGuide(createScoringGuideDTO: CreateScoringGuideDTO) {
        try {
            const isPreEventExists = await this.preEventRepository.findOne({
                where: { id: createScoringGuideDTO.preEventId },
                relations: ['onlineEvent.scoringGuide', 'instructor']
            })
            //every scoring guide should have an isPreEventExists
            if (!isPreEventExists) {
                throw new BadRequestException('Event does not exist')
            }

            if (isPreEventExists?.onlineEvent?.scoringGuide) {
                // Retrieve existing LMS data if present
                const existingLmsData = isPreEventExists.onlineEvent.scoringGuide.scoringGuide || null;

                const ipfsUrl = await this.uploadToPinata(
                    createScoringGuideDTO,
                    isPreEventExists.instructor,
                    existingLmsData
                )
                
                const updateData: any = {
                        fieldOfKnowledge:
                            createScoringGuideDTO.fieldOfKnowledge,
                        taxonomyOfSkill: createScoringGuideDTO.taxonomyOfSkill,
                        attendanceToken: createScoringGuideDTO.attendanceToken,
                        scoreTokenAmount:
                            createScoringGuideDTO.scoreTokenAmount,
                        helpTokenAmount: createScoringGuideDTO.helpTokenAmount,
                        instructorScoreToken:
                            createScoringGuideDTO.instructorScoreToken
                }

                if (ipfsUrl && ipfsUrl.IpfsHash) {
                    updateData.ipfsHash = ipfsUrl.IpfsHash
                } else {
                    console.warn('IPFS Upload failed or returned no hash. Proceeding without updating IPFS hash.')
                }

                await this.scoringGuideRepository.update(
                    isPreEventExists.onlineEvent.scoringGuide.id,
                    updateData
                )

                // Auto-create course on-chain for LMS-imported events
                // (Course already exists in LMS, so we auto-create it on-chain)
                if (isPreEventExists.eventType === 'LMS_IMPORT' && !isPreEventExists.onlineEvent.courseCreateStatus) {
                    try {
                        console.log(`[EventService] Auto-creating course for LMS import: ${isPreEventExists.eventName}`)
                        
                        // Fetch full event data with all relations needed for course creation
                        const fullEvent = await this.preEventRepository.findOne({
                            where: { id: isPreEventExists.id },
                            relations: [
                                'postevents',
                                'onlineEvent',
                                'onlineEvent.scoringGuide',
                                'institution',
                                'instructor',
                                'instructor.role'
                            ]
                        })

                        if (!fullEvent || !fullEvent.instructor) {
                            throw new Error('Event or instructor not found')
                        }

                        // Get institution - try from preevent first, then from instructor's other preevents, then from all institutions
                        let institution = fullEvent.institution
                        
                        if (!institution) {
                            // Try to get institution from instructor's other preevents
                            const instructorPreevents = await this.preEventRepository.find({
                                where: { instructor: { id: fullEvent.instructor.id } },
                                relations: ['institution'],
                                take: 1
                            })
                            
                            if (instructorPreevents.length > 0 && instructorPreevents[0].institution) {
                                institution = instructorPreevents[0].institution
                                console.log(`[EventService] Found institution from instructor's other preevents: ${institution.name}`)
                            } else {
                                // Fallback: Get first active institution (for single-tenant scenarios)
                                const activeInstitutions = await this.institutionRepository.find({
                                    where: { status: true },
                                    take: 1
                                })
                                
                                if (activeInstitutions.length > 0) {
                                    institution = activeInstitutions[0]
                                    console.log(`[EventService] Using first active institution: ${institution.name}`)
                                    
                                    // Set institution on preevent for future use
                                    fullEvent.institution = institution
                                    await this.preEventRepository.save(fullEvent)
                                } else {
                                    throw new Error('No active institution found. Please ensure at least one institution is registered and active.')
                                }
                            }
                        }

                        if (!institution || !institution.publicAddress) {
                            throw new Error(`Institution missing or has no public address. Institution: ${institution ? institution.name : 'null'}`)
                        }

                        console.log(`[EventService] Using institution: ${institution.name} (${institution.publicAddress})`)

                        // Ensure instructor is linked to institution on-chain
                        try {
                            console.log(`[EventService] Verifying instructor ${fullEvent.instructor.id} linkage to institution ${institution.id} on-chain...`)
                            
                            const currentTimestamp = Math.floor(Date.now() / 1000)

                            // First, ensure instructor is registered on-chain if DB says they aren't
                            if (fullEvent.instructor.status !== true) {
                                console.log(`[EventService] Registering instructor on-chain first (Status is false)...`)
                                await this.smartcontractService.onboardingActor({
                                    role: 'instructor',
                                    id: fullEvent.instructor.id,
                                    functionName: 'registerInstructor',
                                    params: [fullEvent.instructor.name, currentTimestamp]
                                })
                            }

                            // Try to link to institution
                            try {
                                await this.smartcontractService.onboardingActor({
                                    role: 'institution',
                                    id: institution.id,
                                    functionName: 'addInstructorToInstitution',
                                    params: [fullEvent.instructor.publicAddress, currentTimestamp]
                                })
                                console.log(`[EventService] Verified/Linked instructor to institution on-chain`)
                            } catch (linkError) {
                                // Handle specific case where instructor is not registered on-chain (even if DB said true)
                                const errorMessage = linkError.message || '';
                                if (errorMessage.includes('Instructor is not registered')) {
                                    console.log(`[EventService] Instructor appears unregistered on-chain despite DB status. Forcing registration...`);
                                    
                                    // Force Register
                                    await this.smartcontractService.onboardingActor({
                                        role: 'instructor',
                                        id: fullEvent.instructor.id,
                                        functionName: 'registerInstructor',
                                        params: [fullEvent.instructor.name, currentTimestamp]
                                    })
                                    
                                    // Retry Link
                                    console.log(`[EventService] Retrying link instructor to institution...`);
                                    await this.smartcontractService.onboardingActor({
                                        role: 'institution',
                                        id: institution.id,
                                        functionName: 'addInstructorToInstitution',
                                        params: [fullEvent.instructor.publicAddress, currentTimestamp]
                                    })
                                    console.log(`[EventService] Successfully linked instructor to institution after recovery`)
                                } else if (errorMessage.includes('Only institution admin has the permission')) {
                                    console.log(`[EventService] Institution registration mismatch (admin permission). Forcing re-registration of institution...`);
                                    
                                    // Re-register institution to sync state/admin
                                    await this.smartcontractService.onboardingActor({
                                        role: 'institution', // This uses institution wallet which should be admin if registered correctly
                                        id: institution.id,
                                        functionName: 'registerInstitution',
                                        params: [institution.name, institution.publicAddress]
                                    });
                                    
                                    // Retry Link
                                    console.log(`[EventService] Retrying link instructor to institution after institution re-registration...`);
                                    await this.smartcontractService.onboardingActor({
                                        role: 'institution',
                                        id: institution.id,
                                        functionName: 'addInstructorToInstitution',
                                        params: [fullEvent.instructor.publicAddress, currentTimestamp]
                                    })
                                    console.log(`[EventService] Successfully linked instructor to institution after recovery`)
                                } else if (errorMessage.includes('Instructor is already in the institution')) {
                                    console.log(`[EventService] Instructor was already linked to institution (caught by error). Continuing.`)
                                } else {
                                    throw linkError; // Re-throw other errors
                                }
                            }
                        } catch (linkError) {
                            console.warn(`[EventService] Warning: Link instructor-institution check failed. Course creation might fail if not already linked. Error: ${linkError.message}`)
                        }

                        // Auto-create course using instructor ID (not req object)
                        await this.smartcontractService.createCourse(
                            fullEvent.instructor.id, // Pass instructor ID instead of req
                            {
                                courseName: fullEvent.eventName,
                                preEventId: fullEvent.id
                            }
                        )
                        console.log(`[EventService] Course auto-created successfully for LMS import`)
                        
                        // Update status to TOKENDISTRIBUTION (skip REVIEWWALLETS for LMS imports)
                        await this.preEventRepository.update(fullEvent.id, {
                            status: PreEventEnum.TOKENDISTRIBUTION
                        })
                    } catch (error) {
                        console.error(`[EventService] Error auto-creating course for LMS import:`, error)
                        console.error(`[EventService] Error details:`, error.message || error)
                        // If auto-creation fails, still allow manual creation via Review Wallets step
                        await this.preEventRepository.update(isPreEventExists.id, {
                            status: PreEventEnum.REVIEWWALLETS
                        })
                    }
                } else {
                    // For non-LMS events, go to REVIEWWALLETS step (manual course creation)
                    await this.preEventRepository.update(isPreEventExists.id, {
                        status: PreEventEnum.REVIEWWALLETS
                    })
                }

                return {
                    status: 201,
                    message: isPreEventExists.eventType === 'LMS_IMPORT' 
                        ? 'Scoring guide created successfully. Course has been automatically created on-chain.'
                        : 'Scoring guide created successfully'
                }
            } else {
                throw new BadRequestException('Scoring guide not created')
            }
        } catch (error) {
            console.log(error)
            throw new HttpException('message', 400, {
                cause: new Error('Some Error')
            })
        }
    }

    findAll() {
        return `This action returns all event`
    }

    async findOne(id: string | number) {
        let whereCondition: any = {};
        
        // Check if id is numeric string
        const isNumeric = !isNaN(Number(id));
        
        if (isNumeric) {
            whereCondition = { id: Number(id) };
        } else {
            whereCondition = { meetingEventId: id };
        }

        const event = await this.preEventRepository.findOne({
            where: whereCondition,
            relations: [
                'onlineEvent', 
                'onlineEvent.scoringGuide', 
                'instructor',
                'postevents',
                'institution'
            ]
        });

        if (!event) {
            throw new BadRequestException('Event not found');
        }

        return event;
    }

    update(id: number, updateEventDto: UpdateEventDto) {
        return `This action updates a #${id} event`
    }

    remove(id: number) {
        return `This action removes a #${id} event`
    }

    async uploadToPinata(
        scoringGuide: CreateScoringGuideDTO,
        instructorData: Instructor,
        existingLmsData: any = null
    ): Promise<any> {
        try {
            if (!process.env.PINATA_JWT) {
                console.warn('PINATA_JWT not found in env, skipping IPFS upload.')
                return null
            }
            const pinata = new PinataSDK({
                pinataJwt: process.env.PINATA_JWT
            })
            
            const payload: any = {
                eventId: scoringGuide.preEventId,
                meetingEventId: scoringGuide.meetingEventId,
                instructorName: instructorData.name,
                instructorEmail: instructorData.email,
                fieldOfKnowledge: scoringGuide.fieldOfKnowledge,
                taxonomyOfSkill: scoringGuide.taxonomyOfSkill,
                attendanceTokenPerLesson: scoringGuide.attendanceToken,
                scoringTokenPerLesson: scoringGuide.scoreTokenAmount,
                helpTokenPerLesson: scoringGuide.helpTokenAmount,
                instructorScoreTokenPerLesson: scoringGuide.instructorScoreToken
            }

            // If we have existing LMS data (e.g. from SDK import), include it
            if (existingLmsData) {
                payload.lmsData = existingLmsData;
            }

            const upload = await pinata.upload.json(payload)
            return upload
        } catch (error) {
            console.log(error)
        }
    }
}
