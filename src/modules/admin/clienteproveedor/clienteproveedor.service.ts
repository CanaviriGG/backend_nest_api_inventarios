import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Nota } from '../nota/entities/nota.entity.js';
import { CreateClienteproveedorDto } from './dto/create-clienteproveedor.dto.js';
import { UpdateClienteproveedorDto } from './dto/update-clienteproveedor.dto.js';
import { Clienteproveedor } from './entities/clienteproveedor.entity.js';

@Injectable()
export class ClienteproveedorService {
  constructor(
    @InjectRepository(Clienteproveedor)
    private readonly clienteproveedorRepository: Repository<Clienteproveedor>,
    @InjectRepository(Nota)
    private readonly notaRepository: Repository<Nota>,
  ) {}

  create(createClienteproveedorDto: CreateClienteproveedorDto) {
    const clienteproveedor = this.clienteproveedorRepository.create({
      ...createClienteproveedorDto,
      estado: createClienteproveedorDto.estado ?? true,
    });

    return this.clienteproveedorRepository.save(clienteproveedor);
  }

  async findAll(page: number = 1, limit: number = 10, search?: string) {
    const queryBuilder = this.clienteproveedorRepository
      .createQueryBuilder('clienteproveedor');

    if (search) {
      queryBuilder.andWhere(
        '(clienteproveedor.razon_social ILIKE :search OR clienteproveedor.identificacion ILIKE :search OR clienteproveedor.correo ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    queryBuilder.skip((page - 1) * limit).take(limit);

    const [clienteproveedores, total] = await queryBuilder.getManyAndCount();
    const totalPages = Math.ceil(total / limit);

    return {
      data: clienteproveedores,
      total,
      limit,
      page,
      totalPages,
      search,
    };
  }

  async findOne(id: number) {
    const clienteproveedor = await this.clienteproveedorRepository
      .createQueryBuilder('clienteproveedor')
      .where('clienteproveedor.id = :id', { id })
      .getOne();

    if (!clienteproveedor) {
      throw new NotFoundException('Cliente o proveedor no encontrado');
    }

    return clienteproveedor;
  }

  async update(
    id: number,
    updateClienteproveedorDto: UpdateClienteproveedorDto,
  ) {
    const clienteproveedor = await this.findOne(id);

    this.clienteproveedorRepository.merge(
      clienteproveedor,
      updateClienteproveedorDto,
    );
    return this.clienteproveedorRepository.save(clienteproveedor);
  }

  async remove(id: number) {
    const clienteproveedor = await this.findOne(id);

    const notasAsociadas = await this.notaRepository.count({
      where: { clienteproveedor: { id } },
    });

    if (notasAsociadas > 0) {
      throw new ConflictException(
        'No se puede eliminar el cliente o proveedor porque tiene notas asociadas',
      );
    }

    return this.clienteproveedorRepository.remove(clienteproveedor);
  }
}
