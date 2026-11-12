import { Column, Entity } from "typeorm";
import { PrimaryGeneratedColumn } from "typeorm/browser";

@Entity('categorias')
export class Categoria {
    @PrimaryGeneratedColumn()
    id:number;

   @Column()
   nombre: string;
   
   @Column({nullable: true})
   descripcion: string;
}
