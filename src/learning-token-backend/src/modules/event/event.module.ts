import { Module, forwardRef } from '@nestjs/common'
import { EventService } from './event.service'
import { EventController } from './event.controller'
import { Type } from 'class-transformer'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ScoringGuide } from './entities/scoring-guide.entity'
import { OnlineEvent } from './entities/event.entity'
import { Preevent } from '../preevent/entities/preevent.entity'
import { SmartcontractModule } from '../smartcontract/smartcontract.module'
import { Learner } from '../learners/entities/learner.entity'
import { Institution } from '../institutions/entities/institution.entity'
import { Postevent } from '../postevent/entities/postevent.entity'

@Module({
    imports: [
        TypeOrmModule.forFeature([OnlineEvent, ScoringGuide, Preevent, Learner, Institution, Postevent]),
        forwardRef(() => SmartcontractModule)
    ],
    controllers: [EventController],
    providers: [EventService],
    exports: [EventService]
})
export class EventModule {}
