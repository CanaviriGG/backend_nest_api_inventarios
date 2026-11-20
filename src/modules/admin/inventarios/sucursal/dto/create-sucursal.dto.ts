import {
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSucursalDto {
  @ApiProperty({
    description: 'Nombre de la sucursal',
    example: 'Sucursal Centro',
    maxLength: 100,
  })
  @IsNotEmpty({
    message: 'El nombre de la sucursal es obligatorio',
  })
  @IsString({
    message: 'El nombre debe ser una cadena de texto',
  })
  @MaxLength(100, {
    message: 'El nombre no puede superar los 100 caracteres',
  })
  nombre: string;

  @ApiProperty({
    description: 'Dirección de la sucursal',
    example: 'Av. Lima 123, Cercado de Lima',
    maxLength: 255,
  })
  @IsNotEmpty({
    message: 'La dirección es obligatoria',
  })
  @IsString({
    message: 'La dirección debe ser una cadena de texto',
  })
  @MaxLength(255, {
    message: 'La dirección no puede superar los 255 caracteres',
  })
  direccion: string;

  @ApiProperty({
    description: 'Teléfono de la sucursal',
    example: '+51 987654321',
    maxLength: 22,
  })
  @IsNotEmpty({
    message: 'El teléfono es obligatorio',
  })
  @IsString({
    message: 'El teléfono debe ser una cadena de texto',
  })
  @MaxLength(22, {
    message: 'El teléfono no puede superar los 22 caracteres',
  })
  telefono: string;

  @ApiProperty({
    description: 'Ciudad donde se encuentra la sucursal',
    example: 'Lima',
    maxLength: 255,
  })
  @IsNotEmpty({
    message: 'La ciudad es obligatoria',
  })
  @IsString({
    message: 'La ciudad debe ser una cadena de texto',
  })
  @MaxLength(255, {
    message: 'La ciudad no puede superar los 255 caracteres',
  })
  ciudad: string;
}
