import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateClienteproveedorDto {
  @ApiProperty({
    description: 'Tipo de persona: cliente o proveedor',
    example: 'cliente',
    enum: ['cliente', 'proveedor'],
  })
  @IsNotEmpty({ message: 'El tipo es obligatorio' })
  @IsIn(['cliente', 'proveedor'], {
    message: "El tipo debe ser 'cliente' o 'proveedor'",
  })
  tipo: 'cliente' | 'proveedor';

  @ApiProperty({
    description: 'Razón social o nombre del cliente/proveedor',
    example: 'Juan Pérez',
    maxLength: 200,
  })
  @IsNotEmpty({ message: 'La razón social es obligatoria' })
  @IsString({ message: 'La razón social debe ser una cadena de texto' })
  @MaxLength(200, {
    message: 'La razón social no puede superar los 200 caracteres',
  })
  razon_social: string;

  @ApiPropertyOptional({
    description: 'Número de identificación (RUC, DNI, etc.)',
    example: '1234567',
    maxLength: 100,
  })
  @IsOptional()
  @IsString({ message: 'La identificación debe ser una cadena de texto' })
  @MaxLength(100, {
    message: 'La identificación no puede superar los 100 caracteres',
  })
  identificacion?: string;

  @ApiPropertyOptional({
    description: 'Dirección del cliente/proveedor',
    example: 'Av. Siempre Viva 742',
    maxLength: 255,
  })
  @IsOptional()
  @IsString({ message: 'La dirección debe ser una cadena de texto' })
  @MaxLength(255, {
    message: 'La dirección no puede superar los 255 caracteres',
  })
  direccion?: string;

  @ApiPropertyOptional({
    description: 'Teléfono de contacto',
    example: '77712345',
    maxLength: 20,
  })
  @IsOptional()
  @IsString({ message: 'El teléfono debe ser una cadena de texto' })
  @MaxLength(20, { message: 'El teléfono no puede superar los 20 caracteres' })
  telefono?: string;

  @ApiPropertyOptional({
    description: 'Correo electrónico de contacto',
    example: 'juan@mail.com',
    maxLength: 200,
  })
  @IsOptional()
  @IsEmail({}, { message: 'El correo electrónico no es válido' })
  @MaxLength(200, { message: 'El correo no puede superar los 200 caracteres' })
  correo?: string;

  @ApiPropertyOptional({
    description: 'Estado del cliente/proveedor',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'El estado debe ser verdadero o falso' })
  estado?: boolean;
}
