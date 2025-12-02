import { Module, forwardRef } from '@nestjs/common'
import { LmsIntegrationService } from './lms-integration.service'
import { LmsIntegrationController } from './lms-integration.controller'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Preevent } from '../preevent/entities/preevent.entity'
import { Postevent } from '../postevent/entities/postevent.entity'
import { OnlineEvent } from '../event/entities/event.entity'
import { ScoringGuide } from '../event/entities/scoring-guide.entity'
import { Learner } from '../learners/entities/learner.entity'
import { AuthModule } from '../auth/auth.module'
import { Role } from '../role/entities/role.entity'
import { Instructor } from '../instructors/entities/instructor.entity'
import { Institution } from '../institutions/entities/institution.entity'
import { SmartcontractModule } from '../smartcontract/smartcontract.module'

@Module({
    imports: [
        TypeOrmModule.forFeature([
            Preevent,
            Postevent,
            OnlineEvent,
            ScoringGuide,
            Learner,
            Role,
            Instructor,
            Institution
        ]),
        AuthModule,
        forwardRef(() => SmartcontractModule)
    ],
    controllers: [LmsIntegrationController],
    providers: [LmsIntegrationService]
})
export class LmsIntegrationModule {}


