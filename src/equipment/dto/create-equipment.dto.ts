import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, MinLength } from "class-validator";

export class CreateEquipmentDto {
    @ApiProperty({
        description: "Equipment name",
        example: "projector"
    })
    @IsString()
    @IsNotEmpty()
    @MinLength(2)
    name!: string
}