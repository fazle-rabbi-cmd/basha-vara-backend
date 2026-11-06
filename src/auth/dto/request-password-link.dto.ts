import { IsEmail, IsNotEmpty, MaxLength } from 'class-validator';

export class RequestPasswordLinkDto {
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(254)
  email: string;
}