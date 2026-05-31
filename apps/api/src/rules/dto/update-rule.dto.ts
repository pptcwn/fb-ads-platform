import { IsString, IsOptional, IsArray, IsNumber, IsBoolean, IsEnum, Min, Max } from 'class-validator';

export class UpdateRuleDto {
  @IsOptional()
  @IsString()
  name?: string;

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

  @IsOptional()
  @IsArray()
  conditions?: { metric: string; operator: string; value: number; window?: string }[];

  @IsOptional()
  @IsEnum(['ALL', 'ANY'])
  logic?: 'ALL' | 'ANY';

  @IsOptional()
  @IsArray()
  actions?: string[];

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1440)
  cooldownMinutes?: number;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}
