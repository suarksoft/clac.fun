import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { ethers } from 'ethers';

@Injectable()
export class EthAddressPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!ethers.isAddress(value)) {
      throw new BadRequestException('Invalid wallet address');
    }
    return value.toLowerCase();
  }
}
