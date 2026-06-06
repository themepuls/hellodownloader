import { Module } from '@nestjs/common';
import { SurveyController } from './survey.controller';
import { FourKInterestService } from './four-k-interest.service';

@Module({
  controllers: [SurveyController],
  providers: [FourKInterestService],
  exports: [FourKInterestService],
})
export class SurveyModule {}
