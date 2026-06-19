import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import DashboardLayout from '@/components/DashboardLayout'
import ChatView from '@/components/ChatView'

export default async function ChatPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/')
  }

  return (
    <DashboardLayout>
      <ChatView />
    </DashboardLayout>
  )
}
