import {
    BadRequestException,
    Injectable,
    NotFoundException
} from '@nestjs/common'
import { CreatePosteventDto } from './dto/create-postevent.dto'
import { UpdatePosteventDto } from './dto/update-postevent.dto'
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm'
import {
    Preevent as Prevent,
    PreEventEnum,
    Preevent
} from '../preevent/entities/preevent.entity'
import { Institution } from '../institutions/entities/institution.entity'
import { DataSource, EntityManager, Repository } from 'typeorm'
import { Postevent } from './entities/postevent.entity'
import { Learner } from '../learners/entities/learner.entity'
import * as bcrypt from 'bcryptjs'
import { getWallet } from 'src/utils/kaledio'
import { sendLoginCredentials } from 'src/common/helpers/utils.helper'
import { Role } from '../role/entities/role.entity'
import { SmartcontractService } from '../smartcontract/smartcontract.service'
@Injectable()
export class PosteventService {
    constructor(
        @InjectRepository(Prevent)
        private readonly preeventRepository: Repository<Prevent>,
        @InjectRepository(Postevent)
        private readonly posteventRepository: Repository<Postevent>,
        @InjectRepository(Learner)
        private readonly learnerRepository: Repository<Learner>,
        @InjectRepository(Role)
        private readonly roleRepository: Repository<Role>,
        @InjectEntityManager()
        private readonly entityManager: EntityManager,
        private readonly smartContractService: SmartcontractService
    ) {}
    async create(createPosteventDto: CreatePosteventDto) {
        const event = await this.preeventRepository.findOne({
            where: { meetingEventId: createPosteventDto.meetingEventId }
        })
        if (!event) {
            throw new Error('Institution not found')
        }

        //every post event will have the same preevent

        await this.entityManager.transaction(
            async (transactionalEntityManager) => {
                // await this.posteventRepository.save(postevent)
                const role = await this.roleRepository.findOne({
                    where: { name: 'learner' }
                })

                for (
                    let index = 0;
                    index < createPosteventDto.attendees.length;
                    index++
                ) {
                    const element = createPosteventDto.attendees[index]
                    const learner = await this.learnerRepository.findOneBy({
                        email: element.email
                    })
                    const postevent = this.posteventRepository.create({
                        ...element,
                        preevent: event
                    })
                    if (!learner) {
                        // Create new learner in database
                        const _learner = new Learner()
                        _learner.name = element.name
                        _learner.role = role
                        _learner.email = element.email

                        const salt: string = bcrypt.genSaltSync(10)
                        _learner.password = bcrypt.hashSync('12345678', salt)

                        const registeredLearner =
                            await transactionalEntityManager.save(
                                Learner,
                                _learner
                            )

                        // Get wallet from Kaleido HD wallet and assign to learner
                        const wallet = await getWallet(
                            'learner',
                            registeredLearner.id
                        )
                        registeredLearner.publicAddress = wallet.address
                        await transactionalEntityManager.save(
                            Learner,
                            registeredLearner
                        )

                        // Register learner on-chain using reusable method (DRY)
                        try {
                            await this.smartContractService.registerLearnerOnChain(
                                registeredLearner.id,
                                registeredLearner.name,
                                registeredLearner.latitude || '0',
                                registeredLearner.longitude || '0'
                            )
                        } catch (error) {
                            console.error(`[PosteventService] Failed to register learner ${registeredLearner.id} on-chain:`, error.message)
                            // Continue processing - don't block other learners
                            // The learner exists in DB but may not be on-chain
                        }
                    } else {
                        // Learner exists - ensure they're registered on-chain
                        if (learner.status !== true) {
                            try {
                                await this.smartContractService.registerLearnerOnChain(
                                    learner.id,
                                    learner.name,
                                    learner.latitude || '0',
                                    learner.longitude || '0'
                                )
                            } catch (error) {
                                console.error(`[PosteventService] Failed to register existing learner ${learner.id} on-chain:`, error.message)
                                // Continue processing
                            }
                        }
                    }
                    //storing the post event user in the table
                    await transactionalEntityManager.save(Postevent, postevent)
                    await transactionalEntityManager.update(
                        Preevent,
                        event.id,
                        {
                            status: PreEventEnum.DEFINESCORINGGUIDE
                        }
                    )
                }
            }
        )

        return {
            status: 201,
            message: 'Post-event created successfully'
        }
    }

    async findAll(preeventId: number) {
        const preevent = await this.preeventRepository.findOne({
            where: { id: preeventId }
        })

        if (!preevent) {
            throw new NotFoundException('Preevent not found')
        }

        const postevents = await this.posteventRepository.find({
            where: { preevent: { id: preeventId } }
        })
        console.log(postevents)
        return postevents
    }

    findOne(id: number) {
        return `This action returns a #${id} postevent`
    }

    update(id: number, updatePosteventDto: UpdatePosteventDto) {
        return `This action updates a #${id} postevent`
    }

    remove(id: number) {
        return `This action removes a #${id} postevent`
    }
}
