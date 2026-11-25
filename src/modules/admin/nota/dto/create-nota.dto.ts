import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class MovimientoDto {
  @ApiProperty({ description: 'ID del producto', example: 10 })
  @IsInt({ message: 'El ID del producto debe ser un número entero' })
  @Min(1, { message: 'El ID del producto debe ser mayor a 0' })
  producto_id: number;

  @ApiProperty({ description: 'ID del almacén', example: 1 })
  @IsInt({ message: 'El ID del almacén debe ser un número entero' })
  @Min(1, { message: 'El ID del almacén debe ser mayor a 0' })
  almacen_id: number;

  @ApiProperty({ description: 'Cantidad movida', example: 5 })
  @IsInt({ message: 'La cantidad debe ser un número entero' })
  @Min(1, { message: 'La cantidad debe ser mayor a 0' })
  cantidad: number;

  @ApiProperty({
    description: 'Tipo de movimiento de stock',
    enum: ['ingreso', 'salida', 'devolucion'],
    example: 'ingreso',
  })
  @IsIn(['ingreso', 'salida', 'devolucion'], {
    message: "El tipo de movimiento debe ser 'ingreso', 'salida' o 'devolucion'",
  })
  tipo_movimiento: 'ingreso' | 'salida' | 'devolucion';

  @ApiPropertyOptional({ description: 'Precio de compra', example: 235.2 })
  @IsOptional()
  @IsNumber({}, { message: 'El precio de compra debe ser un número' })
  @Min(0, { message: 'El precio de compra no puede ser negativo' })
  precio_compra?: number;

  @ApiPropertyOptional({ description: 'Precio de venta', example: 250.5 })
  @IsOptional()
  @IsNumber({}, { message: 'El precio de venta debe ser un número' })
  @Min(0, { message: 'El precio de venta no puede ser negativo' })
  precio_venta?: number;

  @ApiPropertyOptional({
    description: 'Observaciones del movimiento',
    example: 'Movimiento generado por compra',
  })
  @IsOptional()
  @IsString({ message: 'Las observaciones deben ser una cadena de texto' })
  observaciones?: string;
}

export class CreateNotaDto {
  @ApiProperty({
    description: 'Tipo de nota',
    enum: ['compra', 'venta', 'devolucion'],
    example: 'compra',
  })
  @IsNotEmpty({ message: 'El tipo de nota es obligatorio' })
  @IsIn(['compra', 'venta', 'devolucion'], {
    message: "El tipo de nota debe ser 'compra', 'venta' o 'devolucion'",
  })
  tipo_nota: 'compra' | 'venta' | 'devolucion';

  @ApiProperty({ description: 'ID del cliente/proveedor', example: 1 })
  @IsInt({ message: 'El ID del cliente/proveedor debe ser un número entero' })
  @Min(1, { message: 'El ID del cliente/proveedor debe ser mayor a 0' })
  clienteproveedor_id: number;

  @ApiPropertyOptional({
    description: 'Observaciones generales de la nota',
    example: 'Observaciones generales de la nota',
  })
  @IsOptional()
  @IsString({ message: 'Las observaciones deben ser una cadena de texto' })
  observaciones?: string;

  @ApiProperty({
    description: 'Movimientos de stock de la nota',
    type: [MovimientoDto],
  })
  @IsArray({ message: 'Los movimientos deben ser un arreglo' })
  @ValidateNested({ each: true })
  @Type(() => MovimientoDto)
  movimientos: MovimientoDto[];
}
