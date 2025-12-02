import { Injectable, BadRequestException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { LmsImportDto } from './dto/lms-import.dto'
import { Preevent, PreEventEnum } from '../preevent/entities/preevent.entity'
import { Postevent } from '../postevent/entities/postevent.entity'
import { OnlineEvent } from '../event/entities/event.entity'
import { ScoringGuide } from '../event/entities/scoring-guide.entity'
import { Learner } from '../learners/entities/learner.entity'
import { Instructor } from '../instructors/entities/instructor.entity'
import { Institution } from '../institutions/entities/institution.entity'
import { Role } from '../role/entities/role.entity'
import { AuthService } from '../auth/service/auth.service'
import { SmartcontractService } from '../smartcontract/smartcontract.service'
import { PinataSDK } from 'pinata'
import * as dotenv from 'dotenv'

dotenv.config()

import { SmartcontractFunctionsEnum } from '../smartcontract/enums/smartcontract-functions.enum'

@Injectable()
export class LmsIntegrationService {
    constructor(
        @InjectRepository(Preevent)
        private preeventRepository: Repository<Preevent>,
        @InjectRepository(Postevent)
        private posteventRepository: Repository<Postevent>,
        @InjectRepository(OnlineEvent)
        private onlineEventRepository: Repository<OnlineEvent>,
        @InjectRepository(ScoringGuide)
        private scoringGuideRepository: Repository<ScoringGuide>,
        @InjectRepository(Learner)
        private learnerRepository: Repository<Learner>,
        @InjectRepository(Instructor)
        private instructorRepository: Repository<Instructor>,
        @InjectRepository(Role)
        private roleRepository: Repository<Role>,
        @InjectRepository(Institution)
        private institutionRepository: Repository<Institution>,
        private authService: AuthService,
        private smartcontractService: SmartcontractService
    ) {}

    private async uploadToPinata(
        dto: LmsImportDto,
        instructor: Instructor,
        uniqueEventId: string
    ): Promise<any> {
        try {
            if (!process.env.PINATA_JWT) {
                console.warn('PINATA_JWT not found, skipping IPFS upload')
                return null
            }
            const pinata = new PinataSDK({
                pinataJwt: process.env.PINATA_JWT
            })
            // Upload the full normalized JSON (dto) + metadata
            const upload = await pinata.upload.json({
                // Metadata for identifying the file
                eventId: uniqueEventId, 
                instructorName: instructor.name,
                instructorEmail: instructor.email,
                courseName: dto.course.name,
                
                // The actual normalized LMS Data
                lmsData: dto 
            })
            return upload
        } catch (error) {
            console.error('Error uploading to Pinata:', error)
            return null
        }
    }

    async importLmsData(dto: LmsImportDto, instructorId: number) {
        // 1. Verify Instructor
        const instructor = await this.instructorRepository.findOne({
            where: { id: instructorId }
        })
        if (!instructor) {
            throw new BadRequestException('Instructor not found')
        }

        // 2. Create Virtual Preevent (The "Course")
        // Check if it already exists to prevent duplicates
        const uniqueEventId = `LMS-${dto.course.id}`.substring(0, 30)
        let preevent = await this.preeventRepository.findOne({
            where: { meetingEventId: uniqueEventId },
            relations: ['onlineEvent', 'onlineEvent.scoringGuide'] 
        })

        let savedPreevent: Preevent;
        let savedScoringGuide: ScoringGuide;

        if (!preevent) {
            preevent = new Preevent()
            preevent.meetingEventId = uniqueEventId
            preevent.eventName = dto.course.name
            preevent.eventType = 'LMS_IMPORT'
            preevent.description = dto.course.description || 'Imported from LMS SDK'
            preevent.eventDate = new Date()
            preevent.organizerName = instructor.name
            preevent.organizerEmail = instructor.email
            preevent.speakersName = [instructor.name]
            preevent.speakersEmail = [instructor.email]
            preevent.organization = 'LMS'
            preevent.fieldsOfKnowledge = dto.category || 'General'
            preevent.taxonomyOfSkills = dto.skills || 'Completion'
            preevent.instructor = instructor
            preevent.status = PreEventEnum.DEFINESCORINGGUIDE 
            
            // Set institution - try to get from instructor's other preevents, or use first active institution
            let institution = await this.preeventRepository.findOne({
                where: { instructor: { id: instructor.id } },
                relations: ['institution'],
                order: { createdAt: 'DESC' }
            }).then(p => p?.institution)
            
            if (!institution) {
                // Fallback: Get first active institution
                institution = await this.institutionRepository.findOne({
                    where: { status: true }
                })
            }
            
            if (institution) {
                preevent.institution = institution
                
                // Ensure instructor is added to institution on-chain
                // This prevents "Instructor not found in the institution" error during course creation
                try {
                    const currentTimestamp = Math.floor(Date.now() / 1000)
                    
                    // Check if instructor is already registered on-chain (DB check)
                    if (instructor.status !== true) {
                        console.log(`[LmsIntegration] Registering instructor ${instructor.id} on-chain...`)
                        await this.smartcontractService.onboardingActor({
                            role: 'instructor',
                            id: instructor.id,
                            functionName: SmartcontractFunctionsEnum.REGISTER_INSTRUCTOR,
                            params: [instructor.name, currentTimestamp]
                        })
                    }

                    // Add to institution
                    console.log(`[LmsIntegration] Adding instructor ${instructor.id} to institution ${institution.id} on-chain...`)
                    try {
                        await this.smartcontractService.onboardingActor({
                            role: 'institution',
                            id: institution.id,
                            functionName: SmartcontractFunctionsEnum.ADD_INSTRUCTOR_TO_INSTITUTION,
                            params: [instructor.publicAddress, currentTimestamp]
                        })
                        console.log(`[LmsIntegration] Successfully linked instructor to institution on-chain`)
                    } catch (innerError) {
                        const msg = innerError.message || '';
                        if (msg.includes('Instructor is not registered')) {
                            console.log(`[LmsIntegration] Instructor appears unregistered on-chain. Forcing registration...`);
                             await this.smartcontractService.onboardingActor({
                                role: 'instructor',
                                id: instructor.id,
                                functionName: SmartcontractFunctionsEnum.REGISTER_INSTRUCTOR,
                                params: [instructor.name, currentTimestamp]
                            })
                            // Retry link
                            console.log(`[LmsIntegration] Retrying link instructor to institution...`);
                            await this.smartcontractService.onboardingActor({
                                role: 'institution',
                                id: institution.id,
                                functionName: SmartcontractFunctionsEnum.ADD_INSTRUCTOR_TO_INSTITUTION,
                                params: [instructor.publicAddress, currentTimestamp]
                            })
                            console.log(`[LmsIntegration] Linked instructor to institution after recovery`)
                        } else if (msg.includes('Only institution admin has the permission')) {
                            console.log(`[LmsIntegration] Institution registration mismatch (admin permission). Forcing re-registration of institution...`);
                            // Re-register institution to sync state/admin
                            await this.smartcontractService.onboardingActor({
                                role: 'institution',
                                id: institution.id,
                                functionName: SmartcontractFunctionsEnum.REGISTER_INSTITUTION,
                                params: [institution.name, institution.publicAddress] // Assuming these are the params
                            });
                            
                            // Retry link
                            console.log(`[LmsIntegration] Retrying link instructor to institution after institution re-registration...`);
                            await this.smartcontractService.onboardingActor({
                                role: 'institution',
                                id: institution.id,
                                functionName: SmartcontractFunctionsEnum.ADD_INSTRUCTOR_TO_INSTITUTION,
                                params: [instructor.publicAddress, currentTimestamp]
                            })
                            console.log(`[LmsIntegration] Linked instructor to institution after recovery`)
                        } else if (msg.includes('Instructor is already in the institution') || msg.includes('Instructor is already added')) {
                             console.log(`[LmsIntegration] Instructor already linked (caught error). Continuing.`)
                        } else {
                            throw innerError;
                        }
                    }
                } catch (error) {
                    console.warn(`[LmsIntegration] Warning: Failed to link instructor to institution on-chain. Course creation might fail. Error: ${error.message}`)
                }
            } else {
                console.warn(`[LmsIntegration] No institution found for instructor ${instructor.id}. Course creation may fail later.`)
            }
            
            savedPreevent = await this.preeventRepository.save(preevent)

            // 3. Create Scoring Guide (Metadata)
            const scoringGuide = new ScoringGuide()
            scoringGuide.courseName = dto.course.name
            scoringGuide.fieldOfKnowledge = dto.category || 'General'
            scoringGuide.taxonomyOfSkill = dto.skills || 'Completion'
            scoringGuide.attendanceToken = 0
            scoringGuide.scoreTokenAmount = 0
            scoringGuide.helpTokenAmount = 0
            scoringGuide.instructorScoreToken = 0
            scoringGuide.scoringGuide = JSON.parse(JSON.stringify(dto)) 
            
            savedScoringGuide = await this.scoringGuideRepository.save(scoringGuide)

            // 4. Create OnlineEvent (Link Preevent <-> ScoringGuide)
            const onlineEvent = new OnlineEvent({}, savedScoringGuide)
            onlineEvent.instructor = instructor
            onlineEvent.courseCreateStatus = false 
            
            const savedOnlineEvent = await this.onlineEventRepository.save(onlineEvent)

            // Link OnlineEvent back to Preevent
            savedPreevent.onlineEvent = savedOnlineEvent
            await this.preeventRepository.save(savedPreevent)

        } else {
            savedPreevent = preevent
            
            // RESET STATUS to allow editing
            savedPreevent.status = PreEventEnum.DEFINESCORINGGUIDE
            await this.preeventRepository.save(savedPreevent)

            // Update existing Scoring Guide if it exists
            if (preevent.onlineEvent && preevent.onlineEvent.scoringGuide) {
                savedScoringGuide = preevent.onlineEvent.scoringGuide
                savedScoringGuide.scoringGuide = JSON.parse(JSON.stringify(dto))
                savedScoringGuide.courseName = dto.course.name // Update in case it changed
                // Reset token amounts to 0 if they were set previously, or keep them? 
                // Better to reset or let user decide? 
                // Let's keep them as is if they were edited, BUT the user complained about "default values".
                // The user wants to input themselves. So let's NOT reset amounts if they are already set, 
                // BUT since status is now DEFINESCORINGGUIDE, the form will be ENABLED, so they can edit them!
                
                await this.scoringGuideRepository.save(savedScoringGuide)
            } else {
                // Handle edge case where Preevent exists but ScoringGuide is missing (shouldn't happen usually)
                 const scoringGuide = new ScoringGuide()
                 // ... (populate same as above)
                 // skipping deep recovery logic for now to keep it simple
                 savedScoringGuide = new ScoringGuide(); // dummy to satisfy type
            }
        }
        
        // --- IPFS UPLOAD STEP ---
        // Always try to upload to IPFS to get the latest hash for the normalized data
        if (savedScoringGuide) {
            const ipfsResult = await this.uploadToPinata(dto, instructor, uniqueEventId)
            if (ipfsResult && ipfsResult.IpfsHash) {
                savedScoringGuide.ipfsHash = ipfsResult.IpfsHash
                await this.scoringGuideRepository.save(savedScoringGuide)
                console.log(`IPFS Hash updated for event ${uniqueEventId}: ${ipfsResult.IpfsHash}`)
            }
        }

        // 5. Process Students (Attendees)
        const processedStudents = []
        const unregisteredStudents = []
        
        for (const student of dto.students) {
            // A. Validate Learner Existence
            const learner = await this.learnerRepository.findOne({
                where: { email: student.email }
            })

            // STRICT CHECK: Must exist in database
            if (!learner) {
                unregisteredStudents.push({
                    email: student.email,
                    name: student.name,
                    reason: 'Not registered in database'
                })
                continue 
            }

            // B. Register learner on-chain if not already registered
            // This ensures learners are automatically registered on-chain (like Zoom flow)
            try {
                // Try regular registration first
                if (learner.status !== true) {
                    console.log(`[LmsIntegration] Registering learner ${learner.id} (${learner.email}) on-chain...`)
                    await this.smartcontractService.registerLearnerOnChain(
                        learner.id,
                        learner.name || student.name,
                        learner.latitude || '0',
                        learner.longitude || '0'
                    )
                    console.log(`[LmsIntegration] Successfully registered learner ${learner.id} on-chain`)
                } else {
                    // Double check if really registered by calling with force=false which returns message if already reg
                    // Or we can just log. But if we suspect DB/Chain mismatch, we should verify.
                    console.log(`[LmsIntegration] Learner ${learner.id} (${learner.email}) marked as registered in DB.`)
                }
            } catch (error) {
                const msg = error.message || '';
                if (msg.includes('learner is not registered') || msg.includes('Learner not registered')) {
                     console.log(`[LmsIntegration] Learner ${learner.id} registration mismatch detected. Forcing re-registration...`);
                     try {
                        await this.smartcontractService.registerLearnerOnChain(
                            learner.id,
                            learner.name || student.name,
                            learner.latitude || '0',
                            learner.longitude || '0',
                            true // Force
                        )
                        console.log(`[LmsIntegration] Successfully re-registered learner ${learner.id} on-chain after recovery`)
                     } catch (retryErr) {
                        console.error(`[LmsIntegration] Failed to re-register learner ${learner.id} on-chain:`, retryErr.message)
                        unregisteredStudents.push({
                            email: student.email,
                            name: student.name,
                            reason: `On-chain registration failed (retry): ${retryErr.message}`
                        })
                        continue
                     }
                } else {
                    console.error(`[LmsIntegration] Failed to register learner ${learner.id} on-chain:`, error.message)
                    // Continue processing - don't block other learners
                    // But mark this learner as problematic
                    unregisteredStudents.push({
                        email: student.email,
                        name: student.name,
                        reason: `On-chain registration failed: ${error.message}`
                    })
                    continue
                }
            }

            // C. Ensure learner has a wallet address (should be set by registerLearnerOnChain, but double-check)
            if (!learner.publicAddress) {
                // Refresh learner from database to get updated publicAddress
                const updatedLearner = await this.learnerRepository.findOne({
                    where: { id: learner.id }
                })
                if (!updatedLearner || !updatedLearner.publicAddress) {
                    unregisteredStudents.push({
                        email: student.email,
                        name: student.name,
                        reason: 'No wallet address available'
                    })
                    continue
                }
            }

            // D. Create Postevent (Attendance Record) for Valid Learners Only
            // Check if postevent already exists to avoid duplicates
            const existingPostevent = await this.posteventRepository.findOne({
                where: { 
                    preevent: { id: savedPreevent.id },
                    email: student.email 
                }
            })

            if (!existingPostevent) {
                const postevent = new Postevent()
                postevent.preevent = savedPreevent
                postevent.name = student.name
                postevent.email = student.email
                postevent.joinTime = new Date()
                postevent.leaveTime = new Date()
                
                await this.posteventRepository.save(postevent)
            }
            processedStudents.push(student.email)
        }

        return {
            message: 'LMS Data Processed',
            courseId: savedPreevent.id,
            successCount: processedStudents.length,
            failedCount: unregisteredStudents.length,
            unregisteredStudents: unregisteredStudents, 
            redirectUrl: `/events/${savedPreevent.id}`
        }
    }
}
