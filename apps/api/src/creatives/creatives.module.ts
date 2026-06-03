import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { extname, join } from 'path';
import { CreativesController } from './creatives.controller';
import { CreativesService } from './creatives.service';
import { FacebookModule } from '../facebook/facebook.module';
import * as fs from 'fs';

const uploadDir = join(process.cwd(), 'uploads', 'creatives');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const multerConfig = {
  dest: uploadDir,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
};

@Module({
  imports: [
    MulterModule.register(multerConfig),
    FacebookModule,
  ],
  controllers: [CreativesController],
  providers: [CreativesService],
})
export class CreativesModule {}
