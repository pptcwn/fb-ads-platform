import { IsString, IsNumber, IsOptional, IsEnum, Min } from 'class-validator';

export class CreateCampaignDto {
  @IsString()
  adAccountId: string;

  @IsString()
  name: string;

  @IsString()
  objective: string;

  @IsNumber()
  @Min(50)
  dailyBudget: number;

  @IsOptional()
  @IsString()
  status?: string;

  // AdSet fields
  @IsOptional()
  @IsString()
  adSetName?: string;

  @IsOptional()
  @IsString()
  optimizationGoal?: string;

  @IsOptional()
  @IsString()
  billingEvent?: string;

  @IsOptional()
  targeting?: any;

  // Ad fields
  @IsOptional()
  @IsString()
  adName?: string;

  @IsOptional()
  @IsString()
  creativeMessage?: string;

  @IsOptional()
  @IsString()
  creativeLink?: string;

  @IsOptional()
  @IsString()
  creativeImageHash?: string;

  @IsOptional()
  @IsString()
  pageId?: string;
}
