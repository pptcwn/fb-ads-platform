import { redirect } from 'next/navigation';

export default function NewCampaignRedirect() {
  redirect('/dashboard/campaigns/create');
}