import { BadRequestException, Injectable } from '@nestjs/common'
import { CreateCourseDto } from './dto/create-course.dto'
import { UpdateSmartcontractDto } from './dto/update-smartcontract.dto'
import { ethers } from 'ethers'
import * as abi from '../../contract-abi/learning-token-abi.json' // Adjust the path as necessary
import { ConfigService } from '@nestjs/config'
import { getWallet } from 'src/utils/kaledio'
import { InjectRepository } from '@nestjs/typeorm'
import { Postevent } from '../postevent/entities/postevent.entity'
import { In, Repository } from 'typeorm'
import { Preevent, PreEventEnum } from '../preevent/entities/preevent.entity'
import { Learner } from '../learners/entities/learner.entity'
import { getIPFSFULLURL } from 'src/common/helpers/utils.helper'
import { CreateSmartcontractDto } from './dto/create-smartcontract.dto'
import { DistributeTokenDto } from './dto/distrbute-token.dto'
import { Institution } from '../institutions/entities/institution.entity'
import { SmartcontractFunctionsEnum } from 'src/modules/smartcontract/enums/smartcontract-functions.enum'
import { Instructor } from '../instructors/entities/instructor.entity'
import { InstructorsService } from '../instructors/instructors.service'
import { CreateInstructorDto } from '../instructors/dto/create-instructor.dto'
import * as etherjs from 'ethers'
import { OnlineEvent } from '../event/entities/event.entity'
import { ScoringGuide } from '../event/entities/scoring-guide.entity'
declare global {
    interface BigInt {
        toJSON(): string // or `number` if precision loss is acceptable
    }
}

// Attach `toJSON` to BigInt prototype to automatically serialize BigInts as strings
BigInt.prototype.toJSON = function (): string {
    return this.toString() // Ensures precision
}

@Injectable()
export class SmartcontractService {
    private readonly provider: ethers.JsonRpcProvider
    private readonly contractAddress: string
    private readonly adminPrivateKey: string
    private readonly adminWalletId: string
    private readonly institutionWalletId: string
    private readonly instructorWalletId: string
    private readonly learnerWalletId: string
    @InjectRepository(Preevent)
    private preEventRepository: Repository<Preevent>
    @InjectRepository(Learner)
    private learnerRepository: Repository<Learner>
    @InjectRepository(Institution)
    private institutionRepository: Repository<Institution>
    @InjectRepository(Instructor)
    private instructorRepository: Repository<Instructor>
    @InjectRepository(ScoringGuide)
    private scoringGuideRepository: Repository<ScoringGuide>
    @InjectRepository(OnlineEvent)
    private onlineEventRepository: Repository<OnlineEvent>

    constructor(private readonly configService: ConfigService) {
        this.contractAddress =
            this.configService.get<string>('CONTRACT_ADDRESS')
        this.adminPrivateKey =
            this.configService.get<string>('ADMIN_PRIVATE_KEY')
        this.adminWalletId =
            this.configService.get<string>('ADMIN_HD_WALLET_ID')
        this.institutionWalletId = this.configService.get<string>(
            'INSTITUTION_HD_WALLET_ID'
        )
        this.instructorWalletId = this.configService.get<string>(
            'INSTRUCTOR_HD_WALLET_ID'
        )
        this.learnerWalletId = this.configService.get<string>(
            'LEARNER_HD_WALLET_ID'
        )
    }

    create(createSmartcontractDto: CreateSmartcontractDto) {
        return 'This action adds a new smartcontract'
    }

    findAll() {
        return `This action returns all smartcontract`
    }

    findOne(id: number) {
        return `This action returns a #${id} smartcontract`
    }

    update(id: number, updateSmartcontractDto: UpdateSmartcontractDto) {
        return `This action updates a #${id} smartcontract`
    }

    remove(id: number) {
        return `This action removes a #${id} smartcontract`
    }

    /**
     * Reusable method to register a learner on-chain
     * Follows DRY principle - used by both LMS integration and Postevent services
     * 
     * @param learnerId - The learner's database ID
     * @param learnerName - The learner's name
     * @param latitude - Optional latitude (defaults to '0')
     * @param longitude - Optional longitude (defaults to '0')
     * @returns Promise with registration result
     * @throws BadRequestException if learner not found, already registered, or registration fails
     */
    async registerLearnerOnChain(
        learnerId: number,
        learnerName: string,
        latitude: string = '0',
        longitude: string = '0',
        force: boolean = false
    ): Promise<{ message: string; result: any }> {
        try {
            // 1. Check if learner exists
            const learner = await this.learnerRepository.findOne({
                where: { id: learnerId }
            })

            if (!learner) {
                throw new BadRequestException(`Learner with ID ${learnerId} not found`)
            }

            // 2. Check if already registered on-chain
            if (!force && learner.status === true) {
                console.log(`[SmartcontractService] Learner ${learnerId} (${learner.email}) is already registered on-chain`)
                return {
                    message: 'Learner already registered on-chain',
                    result: null
                }
            }

            // 3. Ensure learner has a wallet address
            if (!learner.publicAddress) {
                // Get wallet from Kaleido HD wallet
                const wallet = await getWallet('learner', learnerId)
                learner.publicAddress = wallet.address
                await this.learnerRepository.save(learner)
                console.log(`[SmartcontractService] Assigned wallet address ${wallet.address} to learner ${learnerId}`)
            }

            // 4. Prepare registration parameters
            const createdAt = learner.createdAt 
                ? Math.floor(new Date(learner.createdAt).getTime() / 1000)
                : Math.floor(Date.now() / 1000)

            const body = {
                role: 'learner',
                id: learnerId,
                functionName: SmartcontractFunctionsEnum.REGISTER_LEARNER,
                params: [
                    learnerName,
                    createdAt,
                    latitude || learner.latitude || '0',
                    longitude || learner.longitude || '0'
                ]
            }

            // 5. Register on-chain using existing onboardingActor method
            const result = await this.onboardingActor(body)

            console.log(`[SmartcontractService] Successfully registered learner ${learnerId} (${learner.email}) on-chain`)
            return result

        } catch (error) {
            console.error(`[SmartcontractService] Error registering learner ${learnerId} on-chain:`, error)
            if (error instanceof BadRequestException) {
                throw error
            }
            throw new BadRequestException(
                `Failed to register learner on-chain: ${error.message}`
            )
        }
    }

    async onboardingActor(body): Promise<any> {
        try {
            const wallet = await getWallet(body.role, body.id)
            const actorPrivateKey = wallet.privateKey
            const contractAddress = this.contractAddress
            const rpcUrl = this.configService.get<string>(
                'JSON_RPC_URL',
                'http://localhost:8545'
            )
            let messageResponse = ''

            const provider = new ethers.JsonRpcProvider(rpcUrl)

            const signer = new ethers.Wallet(actorPrivateKey, provider)
            const contract = new ethers.Contract(contractAddress, abi, signer)

            let result = await contract[body.functionName](...body.params)
            //external sleep for 10 seconds
            await new Promise((r) => setTimeout(r, 10000))
            // Convert BigInt values to strings if needed

            // const processedResult = this.processResult(result)
            // console.log('View Function Result:', processedResult)

            if (
                body.functionName ===
                SmartcontractFunctionsEnum.REGISTER_INSTITUTION
            ) {
                await this.institutionRepository.update(
                    {
                        publicAddress: body.params[1]
                    },
                    {
                        status: true
                    }
                )
                messageResponse = 'Institution onboarded successfully'
            } else if (
                body.functionName ===
                SmartcontractFunctionsEnum.REGISTER_INSTRUCTOR
            ) {
                await this.instructorRepository.update(body.id, {
                    status: true
                })
                messageResponse = 'Instructor onboarded successfully'
            } else if (
                body.functionName ===
                SmartcontractFunctionsEnum.ADD_INSTRUCTOR_TO_INSTITUTION
            ) {
                messageResponse = 'Instructor added to institution successfully'
            } else if (
                body.functionName ===
                SmartcontractFunctionsEnum.REGISTER_LEARNER
            ) {
                await this.learnerRepository.update(body.id, {
                    status: true
                })
                messageResponse = 'Learner onboarded successfully'
            }
            if (
                body.functionName ===
                SmartcontractFunctionsEnum.LEARNER_TOKEN_METADATA
            ) {
                messageResponse = 'Learner token metadata fetch successfully'
            } else if (
                body.functionName === SmartcontractFunctionsEnum.TOKEN_BALANCE
            ) {
                messageResponse = 'Token balance fetch successfully'
            }
            return {
                message: messageResponse,
                result: result
            }
        } catch (err) {
            console.error('[onboardingActor] Error:', err)
            // Rethrow specific errors or include original message
            if (err.reason) {
                throw new BadRequestException(`Onboarding failed: ${err.reason}`)
            }
            if (err.message && err.message.includes('execution reverted')) {
                throw new BadRequestException(`Onboarding failed: ${err.message}`)
            }
            throw new BadRequestException(`Error in onboarding institution: ${err.message || 'Unknown error'}`)
        }
    }

    async callContractFunction(functionName: string, body?: any): Promise<any> {
        try {
            // Create a contract instance
            const contractAddress = this.contractAddress
            //when we have to call from admin permission
            if (body.isAdmin && body.isWrite) {
                const adminPrivateKey = this.adminPrivateKey
                const signer = new ethers.Wallet(adminPrivateKey, this.provider)
                const contract = new ethers.Contract(
                    contractAddress,
                    abi,
                    signer
                )
                const result = await contract[body.functionName](...body.params)
                // Convert BigInt values to strings if needed
                const processedResult = this.processResult(result)
                return processedResult
            }
            if (body.isWrite) {
                const wallet = await getWallet(body.type, body.id)
                const adminPrivateKey = wallet.privateKey
                const signer = new ethers.Wallet(adminPrivateKey, this.provider)
                const contract = new ethers.Contract(
                    contractAddress,
                    abi,
                    signer
                )
                const result = await contract[body.functionName](...body.params)
                // Convert BigInt values to strings if needed
                const processedResult = this.processResult(result)
                return processedResult
            }
            if (body.isView) {
                const contract = new ethers.Contract(
                    contractAddress,
                    abi,
                    this.provider
                )
                const result = await contract[body.functionName](...body.params)
                console.log('View Function Result:', result)
            }
        } catch (err) {
            console.log(err)
            return err
        }
    }

    /**
     * Create course on-chain (can be called with req or with instructorId for auto-creation)
     */
    async createCourse(
        reqOrInstructorId: any,
        createCourseDto: CreateCourseDto
    ): Promise<any> {
        try {
            // Fetch pre-event and related post-events and scoring guide
            const courseEvent = await this.preEventRepository.findOne({
                where: {
                    id: createCourseDto.preEventId
                },
                relations: [
                    'postevents',
                    'onlineEvent',
                    'onlineEvent.scoringGuide',
                    'institution'
                ]
            })

            if (!courseEvent) {
                throw new BadRequestException('Pre-event not found')
            }

            if (!courseEvent.onlineEvent?.scoringGuide) {
                throw new BadRequestException('Scoring guide not found. Please create a scoring guide first.')
            }

            // Accumulate all the email addresses of the attendees
            const attendees = courseEvent.postevents.map(
                (postevent: Postevent) => postevent.email
            )

            if (attendees.length === 0) {
                throw new BadRequestException('No learners found for this event')
            }

            // Find all the learner IDs with similar email addresses
            // CRITICAL: Only include learners that are registered on-chain (status = true)
            const learnerEntities = await this.learnerRepository.find({
                where: {
                    email: In(attendees),
                    status: true // Only registered learners
                },
                select: ['id', 'email', 'name', 'publicAddress', 'status']
            })
            
            const learnerAddress = learnerEntities
                .filter(learner => learner.publicAddress) // Ensure they have a wallet address
                .map((learner) => learner.publicAddress)

            if (learnerAddress.length === 0) {
                // Find unregistered learners to provide helpful error message
                const allLearners = await this.learnerRepository.find({
                    where: {
                        email: In(attendees)
                    },
                    select: ['email', 'name', 'status', 'publicAddress']
                })
                
                const unregisteredLearners = allLearners.filter(l => !l.status || !l.publicAddress)
                
                if (unregisteredLearners.length > 0) {
                    const unregisteredEmails = unregisteredLearners.map(l => l.email).join(', ')
                    throw new BadRequestException(
                        `Cannot create course: The following learners are not registered on-chain: ${unregisteredEmails}. ` +
                        `Please ensure all learners are registered on the blockchain before creating a course.`
                    )
                }
                
                throw new BadRequestException(
                    'No registered learners found with matching emails. Please ensure learners are registered on-chain first.'
                )
            }
            
            // Log for debugging
            console.log(`[createCourse] Found ${learnerAddress.length} registered learners: ${learnerEntities.map(l => l.email).join(', ')}`)

            // Retrieve course details
            const _institutionAddress = courseEvent.institution.publicAddress
            const _courseName = createCourseDto.courseName
            const _scoringGuideGradingPolicyBookURL = getIPFSFULLURL(
                courseEvent.onlineEvent.scoringGuide.ipfsHash
            )

            // Get the current timestamp for _createdAt
            const createdAt = Math.floor(Date.now() / 1000)

            // Support both req object (from API) and instructorId (for auto-creation)
            let instructorId: number
            let roleName: string
            
            if (typeof reqOrInstructorId === 'object' && reqOrInstructorId.user) {
                // Called from API with req object
                instructorId = reqOrInstructorId.user.id
                roleName = reqOrInstructorId.user.role.name
            } else if (typeof reqOrInstructorId === 'number') {
                // Called programmatically with instructorId
                instructorId = reqOrInstructorId
                // Get role from instructor
                const instructor = await this.instructorRepository.findOne({
                    where: { id: instructorId },
                    relations: ['role']
                })
                if (!instructor || !instructor.role) {
                    throw new BadRequestException('Instructor or role not found')
                }
                roleName = instructor.role.name
            } else {
                throw new BadRequestException('Invalid request format')
            }

            // Define the contract address and create a signer
            const wallet = await getWallet(roleName, instructorId)
            const actorPrivateKey = wallet.privateKey
            const contractAddress = this.contractAddress
            const rpcUrl = this.configService.get<string>(
                'JSON_RPC_URL',
                'http://localhost:8545'
            )
            const provider = new ethers.JsonRpcProvider(rpcUrl)
            const signer = new ethers.Wallet(actorPrivateKey, provider)
            const contract = new ethers.Contract(contractAddress, abi, signer)
            
            // Call to create course function with fixed parameters
            let tx;
            let receipt;

            try {
                tx = await contract.createCourse(
                    _institutionAddress,
                    _courseName,
                    createdAt,
                    learnerAddress,
                    _scoringGuideGradingPolicyBookURL
                )
                console.log(`[createCourse] Transaction sent: ${tx.hash}`)
                receipt = await tx.wait()
                console.log(`[createCourse] Transaction confirmed in block: ${receipt.blockNumber}`)
            } catch (err) {
                if (err.message && (err.message.includes('learner is not registered') || err.message.includes('Learner not registered'))) {
                    console.log('[createCourse] Learner registration mismatch detected. Forcing re-registration of learners...');
                    
                    // Re-register all learners
                    for (const learner of learnerEntities) {
                        try {
                            console.log(`[createCourse] Re-registering learner ${learner.email} (ID: ${learner.id})...`);
                            await this.registerLearnerOnChain(learner.id, learner.name, undefined, undefined, true);
                        } catch (regErr) {
                            console.error(`[createCourse] Failed to re-register learner ${learner.email}:`, regErr);
                        }
                    }

                    console.log('[createCourse] Retrying course creation after re-registration...');
                    tx = await contract.createCourse(
                        _institutionAddress,
                        _courseName,
                        createdAt,
                        learnerAddress,
                        _scoringGuideGradingPolicyBookURL
                    )
                    console.log(`[createCourse] Retry Transaction sent: ${tx.hash}`)
                    receipt = await tx.wait()
                    console.log(`[createCourse] Retry Transaction confirmed in block: ${receipt.blockNumber}`)
                } else {
                    throw err;
                }
            }

            // Parse the CourseCreated event to get the actual on-chain course ID
            const courseCreatedEvent = receipt.logs.find((log: any) => {
                try {
                    const parsedLog = contract.interface.parseLog(log)
                    return parsedLog && parsedLog.name === 'CourseCreated'
                } catch {
                    return false
                }
            })

            let onChainCourseId: number | null = null
            if (courseCreatedEvent) {
                const parsedLog = contract.interface.parseLog(courseCreatedEvent)
                onChainCourseId = Number(parsedLog.args[0]) // First argument is courseId
                console.log(`[createCourse] Course ID from event: ${onChainCourseId}`)
            } else {
                // Fallback: if event parsing fails, we can't proceed
                throw new BadRequestException('Failed to retrieve course ID from transaction. Course creation may have failed.')
            }

            if (onChainCourseId === null || onChainCourseId === undefined || onChainCourseId < 0) {
                throw new BadRequestException('Invalid course ID received from blockchain')
            }

            // Store the actual on-chain course ID (not the preevent ID)
            await this.scoringGuideRepository.update(
                courseEvent.onlineEvent.scoringGuide.id,
                {
                    courseId: onChainCourseId,
                    courseName: createCourseDto.courseName
                }
            )
            await this.onlineEventRepository.update(
                courseEvent.onlineEvent.id,
                {
                    courseCreateStatus: true
                }
            )
            await this.preEventRepository.update(courseEvent.id, {
                status: PreEventEnum.TOKENDISTRIBUTION
            })
            
            return {
                message: 'Course created successfully',
                result: {
                    courseId: onChainCourseId,
                    transactionHash: tx.hash,
                    blockNumber: receipt.blockNumber
                }
            }
        } catch (err) {
            console.error('[createCourse] Error:', err)
            if (err instanceof BadRequestException) {
                throw err
            }
            throw new BadRequestException(`Failed to create course: ${err.message || 'Unknown error'}`)
        }
    }

    async distributeToken(
        req: any,
        distributeTokenDto: DistributeTokenDto
    ): Promise<any> {
        try {
            // Fetch pre-event and related post-events and scoring guide
            const eventDataForTokenDistribution =
                await this.preEventRepository.findOne({
                    where: {
                        id: distributeTokenDto.preEventId
                    },
                    relations: ['postevents', 'onlineEvent.scoringGuide']
                })

            if (!eventDataForTokenDistribution) {
                throw new BadRequestException('Pre-event not found')
            }

            if (!eventDataForTokenDistribution.onlineEvent?.scoringGuide) {
                throw new BadRequestException('Scoring guide not found')
            }

            // Validate that course was created on-chain
            if (!eventDataForTokenDistribution.onlineEvent.courseCreateStatus) {
                throw new BadRequestException('Course must be created on-chain before distributing tokens. Please complete the "Review Wallets" step first.')
            }

            // Retrieve course details - CRITICAL: Validate courseId exists and is valid
            const scoringGuide = eventDataForTokenDistribution.onlineEvent.scoringGuide
            const onChainCourseId = scoringGuide.courseId

            // Check for null/undefined or negative. 0 is a valid ID on blockchain.
            if (onChainCourseId === null || onChainCourseId === undefined || onChainCourseId < 0) {
                throw new BadRequestException(
                    'Invalid course ID. Course may not have been created on-chain. Please recreate the course.'
                )
            }

            // Use onChainCourseId directly as it comes from the event (already correct index)
            // Do NOT subtract 1 anymore.
            const courseId = onChainCourseId

            if (courseId < 0) {
                throw new BadRequestException(
                    `Invalid course ID calculation: onChainCourseId=${onChainCourseId}, courseId=${courseId}`
                )
            }

            // Accumulate all the email addresses of the attendees
            const attendees = eventDataForTokenDistribution.postevents.map(
                (postevent: Postevent) => postevent.email
            )

            if (attendees.length === 0) {
                throw new BadRequestException('No learners found for this event')
            }

            // Find all the learner IDs with similar email addresses
            const learnerEntities = await this.learnerRepository.find({
                where: {
                    email: In(attendees)
                },
                select: ['id', 'publicAddress']
            })

            if (learnerEntities.length === 0) {
                throw new BadRequestException('No registered learners found with matching emails')
            }

            // Define the contract address and create a signer (needed for reading contract state)
            const wallet = await getWallet(req.user.role.name, req.user.id)
            const actorPrivateKey = wallet.privateKey
            const contractAddress = this.contractAddress
            const rpcUrl = this.configService.get<string>(
                'JSON_RPC_URL',
                'http://localhost:8545'
            )
            const provider = new ethers.JsonRpcProvider(rpcUrl)
            const signer = new ethers.Wallet(actorPrivateKey, provider)
            const contract = new ethers.Contract(contractAddress, abi, signer)

            let learnerIds = []

            // Resolve on-chain learner IDs from addresses
            // We cannot rely on (DB ID - 1) because on-chain registration order might differ
            const targetLearners = (!distributeTokenDto.userIds || distributeTokenDto.userIds.length === 0)
                ? learnerEntities
                : learnerEntities.filter(l => distributeTokenDto.userIds.includes(l.id))

            if (targetLearners.length === 0) {
                throw new BadRequestException('No valid learners selected for token distribution')
            }

            console.log(`[distributeToken] Resolving on-chain IDs for ${targetLearners.length} learners...`)
            
            learnerIds = await Promise.all(targetLearners.map(async (learner) => {
                if (!learner.publicAddress) {
                    throw new BadRequestException(`Learner ${learner.id} has no wallet address. Please ensure they are registered.`)
                }
                try {
                    // Call public mapping: learners(address)
                    // Returns struct: (_learnerId, learnerName, createdAt, lat, long)
                    const learnerStruct = await contract.learners(learner.publicAddress)
                    const onChainId = Number(learnerStruct[0]) // _learnerId is the first element
                    
                    // Verify the ID is valid (contract returns 0 for non-existent, but 0 is also a valid ID for the first learner)
                    // We can check if the name is empty to confirm existence
                    if (learnerStruct[1] === '') {
                         throw new Error('Learner not registered on-chain')
                    }
                    return onChainId
                } catch (error) {
                    console.error(`[distributeToken] Failed to resolve ID for learner ${learner.id} (${learner.publicAddress}):`, error.message)
                    throw new BadRequestException(`Learner ${learner.id} is not properly registered on the smart contract.`)
                }
            }))

            if (learnerIds.length === 0) {
                throw new BadRequestException('No valid learners found on-chain')
            }

            const fieldOfKnowledge = scoringGuide.fieldOfKnowledge
            const taxonomyOfSkill = scoringGuide.taxonomyOfSkill

            // Get the current timestamp for _createdAt
            const createdAt = Math.floor(Date.now() / 1000)

            let tx: any
            let tokenType = ''
            let receipt: any

            // Call the appropriate batch mint function based on token type
            if (
                distributeTokenDto.functionName === 'batchMintAttendanceToken'
            ) {
                const amount = new Array(learnerIds.length).fill(
                    scoringGuide.attendanceToken
                )

                if (!amount[0] || amount[0] <= 0) {
                    throw new BadRequestException('Attendance token amount must be greater than 0')
                }

                console.log(`[distributeToken] Minting attendance tokens: courseId=${courseId}, learners=${learnerIds.length}, amount=${amount[0]}`)
                tx = await contract.batchMintAttendanceToken(
                    learnerIds,
                    amount,
                    courseId,
                    createdAt,
                    fieldOfKnowledge,
                    taxonomyOfSkill
                )
                tokenType = 'attendance'

                // Wait for transaction confirmation before updating status
                console.log(`[distributeToken] Transaction sent: ${tx.hash}`)
                receipt = await tx.wait()
                console.log(`[distributeToken] Transaction confirmed in block: ${receipt.blockNumber}`)

                await this.onlineEventRepository.update(
                    eventDataForTokenDistribution.onlineEvent.id,
                    {
                        attendanceTokenMintStatus: true
                    }
                )
            } else if (distributeTokenDto.functionName === 'batchMintScoreToken') {
                const amount = new Array(learnerIds.length).fill(
                    scoringGuide.scoreTokenAmount
                )

                if (!amount[0] || amount[0] <= 0) {
                    throw new BadRequestException('Score token amount must be greater than 0')
                }

                console.log(`[distributeToken] Minting score tokens: courseId=${courseId}, learners=${learnerIds.length}, amount=${amount[0]}`)
                tx = await contract.batchMintScoreToken(
                    learnerIds,
                    amount,
                    courseId,
                    createdAt,
                    fieldOfKnowledge,
                    taxonomyOfSkill
                )
                tokenType = 'score'

                // Wait for transaction confirmation before updating status
                console.log(`[distributeToken] Transaction sent: ${tx.hash}`)
                receipt = await tx.wait()
                console.log(`[distributeToken] Transaction confirmed in block: ${receipt.blockNumber}`)

                await this.onlineEventRepository.update(
                    eventDataForTokenDistribution.onlineEvent.id,
                    {
                        scoreTokenMintStatus: true
                    }
                )
            } else if (distributeTokenDto.functionName === 'batchMintHelpingToken') {
                const amount = new Array(learnerIds.length).fill(
                    scoringGuide.helpTokenAmount
                )

                if (!amount[0] || amount[0] <= 0) {
                    throw new BadRequestException('Help token amount must be greater than 0')
                }

                console.log(`[distributeToken] Minting help tokens: courseId=${courseId}, learners=${learnerIds.length}, amount=${amount[0]}`)
                tx = await contract.batchMintHelpingToken(
                    learnerIds,
                    amount,
                    courseId,
                    createdAt,
                    fieldOfKnowledge,
                    taxonomyOfSkill
                )
                tokenType = 'help'

                // Wait for transaction confirmation before updating status
                console.log(`[distributeToken] Transaction sent: ${tx.hash}`)
                receipt = await tx.wait()
                console.log(`[distributeToken] Transaction confirmed in block: ${receipt.blockNumber}`)

                await this.onlineEventRepository.update(
                    eventDataForTokenDistribution.onlineEvent.id,
                    {
                        helpTokenMintStatus: true
                    }
                )
            } else if (
                distributeTokenDto.functionName ===
                'batchMintInstructorScoreToken'
            ) {
                const amount = new Array(learnerIds.length).fill(
                    scoringGuide.instructorScoreToken
                )

                if (!amount[0] || amount[0] <= 0) {
                    throw new BadRequestException('Instructor score token amount must be greater than 0')
                }

                console.log(`[distributeToken] Minting instructor score tokens: courseId=${courseId}, learners=${learnerIds.length}, amount=${amount[0]}`)
                tx = await contract.batchMintInstructorScoreToken(
                    learnerIds,
                    amount,
                    courseId,
                    createdAt,
                    fieldOfKnowledge
                )
                tokenType = 'instructor_score'

                // Wait for transaction confirmation before updating status
                console.log(`[distributeToken] Transaction sent: ${tx.hash}`)
                receipt = await tx.wait()
                console.log(`[distributeToken] Transaction confirmed in block: ${receipt.blockNumber}`)

                await this.onlineEventRepository.update(
                    eventDataForTokenDistribution.onlineEvent.id,
                    {
                        mintInstructorScoreTokenStatus: true
                    }
                )
            } else {
                throw new BadRequestException(`Unknown function name: ${distributeTokenDto.functionName}`)
            }

            // Check if all tokens have been minted and mark event as completed
            const updatedEvent = await this.onlineEventRepository.findOne({
                where: { id: eventDataForTokenDistribution.onlineEvent.id }
            })

            if (
                updatedEvent.scoreTokenMintStatus &&
                updatedEvent.attendanceTokenMintStatus &&
                updatedEvent.helpTokenMintStatus &&
                updatedEvent.mintInstructorScoreTokenStatus
            ) {
                await this.preEventRepository.update(
                    eventDataForTokenDistribution.id,
                    {
                        status: PreEventEnum.COMPLETED
                    }
                )
            }
            
            return {
                message: `${tokenType.charAt(0).toUpperCase() + tokenType.slice(1)} tokens distributed successfully`,
                result: {
                    transactionHash: tx.hash,
                    blockNumber: receipt.blockNumber,
                    courseId: onChainCourseId,
                    learnersCount: learnerIds.length
                }
            }
        } catch (err) {
            console.error('[distributeToken] Error:', err)
            if (err instanceof BadRequestException) {
                throw err
            }
            throw new BadRequestException(`Failed to distribute tokens: ${err.message || 'Unknown error'}`)
        }
    }

    async findCourseLearnerAddressAndName(
        preEventId,
        page,
        limit
    ): Promise<any> {
        try {
            const skip = (page - 1) * limit

            return await this.preEventRepository
                .createQueryBuilder('preEvent')
                .leftJoinAndSelect('preEvent.postevents', 'postevent')
                .select([
                    'preEvent.id', // keep the primary preEvent fields you need
                    'postevent.id',
                    'postevent.name', // select specific fields from postevents
                    'postevent.email'
                ])
                .where('preEvent.id = :id', { id: preEventId })
                .skip(skip)
                .take(limit)
                .getOne()
        } catch (err) {
            console.log(err)
            throw new BadRequestException(
                'error in fetching course learner list'
            )
        }
    }

    async processResult(result: any): Promise<any> {
        if (typeof result === 'bigint') {
            return result.toString()
        } else if (Array.isArray(result)) {
            return result.map((item) =>
                typeof item === 'bigint' ? item.toString() : item
            )
        } else if (typeof result === 'object' && result !== null) {
            const processedObj: any = {}
            for (const key in result) {
                if (Object.prototype.hasOwnProperty.call(result, key)) {
                    processedObj[key] =
                        typeof result[key] === 'bigint'
                            ? result[key].toString()
                            : result[key]
                }
            }
            return processedObj
        } else {
            return result
        }
    }
}
