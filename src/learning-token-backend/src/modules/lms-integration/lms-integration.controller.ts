import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common'
import { LmsIntegrationService } from './lms-integration.service'
import { LmsImportDto } from './dto/lms-import.dto'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'

@Controller('lms-integration')
export class LmsIntegrationController {
    constructor(private readonly lmsIntegrationService: LmsIntegrationService) {}

    @Post('import')
    @UseGuards(JwtAuthGuard)
    async importLmsData(@Request() req, @Body() lmsImportDto: LmsImportDto) {
        // req.user is populated by JwtAuthGuard. Contains { id, role, ... }
        return await this.lmsIntegrationService.importLmsData(
            lmsImportDto,
            req.user.id
        )
    }
}


