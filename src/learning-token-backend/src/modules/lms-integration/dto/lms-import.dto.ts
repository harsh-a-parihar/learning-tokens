import { IsArray, IsEmail, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'

export class LmsStudentDto {
    @IsNotEmpty()
    @IsString()
    name: string

    @IsNotEmpty()
    @IsEmail()
    email: string

    @IsOptional()
    @IsString()
    grade?: string

    @IsOptional()
    @IsNumber()
    score?: number
}

export class LmsCourseDto {
    @IsNotEmpty()
    @IsString()
    id: string

    @IsNotEmpty()
    @IsString()
    name: string

    @IsOptional()
    @IsString()
    description?: string

    @IsOptional()
    @IsString()
    url?: string
}

export class LmsImportDto {
    @IsNotEmpty()
    @ValidateNested()
    @Type(() => LmsCourseDto)
    course: LmsCourseDto

    @IsNotEmpty()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => LmsStudentDto)
    students: LmsStudentDto[]

    @IsOptional()
    @IsString()
    category?: string // For Field of Knowledge

    @IsOptional()
    @IsString()
    skills?: string // Comma separated skills
}


