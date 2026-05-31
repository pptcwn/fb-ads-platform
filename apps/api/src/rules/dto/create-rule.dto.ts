import { IsString, IsOptional, IsArray, IsNumber, IsEnum, Min, Max } from 'class-validator';

export class CreateRuleDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(['CAMPAIGN', 'ADSET', 'AD', 'ACCOUNT'])
  scope?: 'CAMPAIGN' | 'ADSET' | 'AD' | 'ACCOUNT';

  @IsOptional()
  @IsString()
  campaignId?: string;

  @IsOptional()
  @IsString()
  adAccountId?: string;

  @IsArray()
  conditions: { metric: string; operator: string; value: number; window?: string }[];

  @IsOptional()
  @IsEnum(['ALL', 'ANY'])
  logic?: 'ALL' | 'ANY';

  @IsArray()
  actions: string[];

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1440)
  cooldownMinutes?: number;
}
