import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Sucursal } from '../sucursal/entities/sucursal.entity.js';
import { CreateAlmacenDto } from './dto/create-almacen.dto.js';
import { UpdateAlmacenDto } from './dto/update-almacen.dto.js';
import { Almacen } from './entities/almacen.entity.js';

@Injectable()
export class AlmacenService {
  constructor(
    @InjectRepository(Almacen)
    private almacenRepository: Repository<Almacen>,
    @InjectRepository(Sucursal)
    private sucursalRepository: Repository<Sucursal>,
  ) {}

  async create(createAlmacenDto: CreateAlmacenDto) {
    const sucursal = await this.sucursalRepository.findOne({
      where: { id: createAlmacenDto.sucursalId },
    });
    if (!sucursal) throw new NotFoundException('Sucursal no encontrada');

    const almacen = this.almacenRepository.create({
      ...createAlmacenDto,
      sucursal,
    });
    return this.almacenRepository.save(almacen);
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
    search?: string,
    sucursal?: number,
  ) {
    const queryBuilder = this.almacenRepository
      .createQueryBuilder('almacen')
      .leftJoinAndSelect('almacen.sucursal', 'sucursal')
      .leftJoinAndSelect('almacen.productos', 'almacenProducto');

    if (search) {
      queryBuilder.andWhere(
        '(almacen.nombre ILIKE :search OR almacen.codigo ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (sucursal && sucursal > 0) {
      queryBuilder.andWhere('sucursal.id = :sucursal', { sucursal });
    }

    queryBuilder.skip((page - 1) * limit).take(limit);

    const [almacenes, total] = await queryBuilder.getManyAndCount();
    const totalPages = Math.ceil(total / limit);

    return {
      data: almacenes,
      total,
      limit,
      page,
      totalPages,
      search,
      sucursal,
    };
  }

  async findOne(id: number) {
    const almacen = await this.almacenRepository
      .createQueryBuilder('almacen')
      .leftJoinAndSelect('almacen.sucursal', 'sucursal')
      .leftJoinAndSelect('almacen.productos', 'almacenProducto')
      .where('almacen.id = :id', { id })
      .getOne();

    if (!almacen) throw new NotFoundException('Almacén no encontrado');

    return almacen;
  }

  async update(id: number, updateAlmacenDto: UpdateAlmacenDto) {
    const almacen = await this.findOne(id);

    const { sucursalId, ...datos } = updateAlmacenDto;

    if (sucursalId) {
      const sucursal = await this.sucursalRepository.findOne({
        where: { id: sucursalId },
      });
      if (!sucursal) throw new NotFoundException('Sucursal no encontrada');
      almacen.sucursal = sucursal;
    }

    this.almacenRepository.merge(almacen, datos);
    return this.almacenRepository.save(almacen);
  }

  async remove(id: number) {
    const almacen = await this.findOne(id);

    if (almacen.productos?.length) {
      throw new BadRequestException(
        'No se puede eliminar el almacén porque tiene productos asociados',
      );
    }

    return this.almacenRepository.remove(almacen);
  }
}
