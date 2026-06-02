import { redirect } from 'next/navigation';

export default function AllCampaignsRedirect() {
  redirect('/dashboard/campaigns');
}
