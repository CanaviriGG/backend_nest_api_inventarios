import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, Request } from '@nestjs/common';
import { Observable } from 'rxjs';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { jwtConstants } from './constants.js';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private JwtService: JwtService){

  }
  async canActivate(
    context: ExecutionContext,
  ):Promise<boolean> {
     
    const request = context.switchToHttp().getRequest();
    //Autorization Bearer eajfbasjkcban
    const[type, token] = request.headers.authorization?.split(' ')??[];
    if(!token){
      throw new UnauthorizedException();
    }

    try {
      const payload = await  this.JwtService.verifyAsync(token, {secret: jwtConstants.secret});
      request['user'] = payload;
    } catch (error) {
            throw new UnauthorizedException();      
    }
    return true;
  }
}
