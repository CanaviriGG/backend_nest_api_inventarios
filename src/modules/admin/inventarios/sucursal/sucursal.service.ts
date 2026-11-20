import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateSucursalDto } from './dto/create-sucursal.dto.js';
import { UpdateSucursalDto } from './dto/update-sucursal.dto.js';
import { Sucursal } from './entities/sucursal.entity.js';

@Injectable()
export class SucursalService {
  constructor(
    @InjectRepository(Sucursal)
    private sucursalRepository: Repository<Sucursal>,
  ) {}

  create(createSucursalDto: CreateSucursalDto) {
    const sucursal = this.sucursalRepository.create(createSucursalDto);
    return this.sucursalRepository.save(sucursal);
  }

  async findAll(page: number = 1, limit: number = 10, search?: string) {
    const queryBuilder = this.sucursalRepository
      .createQueryBuilder('sucursal')
      .leftJoinAndSelect('sucursal.almacenes', 'almacen');

    if (search) {
      queryBuilder.andWhere(
        '(sucursal.nombre ILIKE :search OR sucursal.ciudad ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    queryBuilder.skip((page - 1) * limit).take(limit);

    const [sucursales, total] = await queryBuilder.getManyAndCount();
    const totalPages = Math.ceil(total / limit);

    return {
      data: sucursales,
      total,
      limit,
      page,
      totalPages,
      search,
    };
  }

  async findOne(id: number) {
    const sucursal = await this.sucursalRepository
      .createQueryBuilder('sucursal')
      .leftJoinAndSelect('sucursal.almacenes', 'almacen')
      .where('sucursal.id = :id', { id })
      .getOne();

    if (!sucursal) throw new NotFoundException('Sucursal no encontrada');

    return sucursal;
  }

  async update(id: number, updateSucursalDto: UpdateSucursalDto) {
    const sucursal = await this.findOne(id);

    this.sucursalRepository.merge(sucursal, updateSucursalDto);
    return this.sucursalRepository.save(sucursal);
  }

  async remove(id: number) {
    const sucursal = await this.findOne(id);

    if (sucursal.almacenes?.length) {
      throw new BadRequestException(
        'No se puede eliminar la sucursal porque tiene almacenes asociados',
      );
    }

    return this.sucursalRepository.remove(sucursal);
  }
}
