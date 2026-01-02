'use client'

import { motion } from 'framer-motion'
import {
  Users,
  TrendingUp,
  Calendar,
  CheckCircle2,
  Circle,
  ArrowRight,
  Activity,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useProfile } from '@/hooks/use-user'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { ROUTES } from '@/lib/constants'

const stats = [
  {
    title: 'Total Disciples',
    value: '0',
    description: 'Start tracking your discipleship',
    icon: Users,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
  },
  {
    title: 'Growth Rate',
    value: '0%',
    description: 'This month',
    icon: TrendingUp,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
  },
  {
    title: 'Sessions',
    value: '0',
    description: 'This week',
    icon: Calendar,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
  },
  {
    title: 'Completed',
    value: '0',
    description: 'Milestones achieved',
    icon: CheckCircle2,
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
  },
]

const gettingStarted = [
  {
    title: 'Complete your profile',
    description: 'Add your name and profile information',
    completed: false,
    href: ROUTES.SETTINGS_PROFILE,
  },
  {
    title: 'Set up your password',
    description: 'Ensure your account is secure',
    completed: false,
    href: ROUTES.SETTINGS_PASSWORD,
  },
  {
    title: 'Choose your theme',
    description: 'Customize the app appearance',
    completed: false,
    href: ROUTES.SETTINGS_APPEARANCE,
  },
  {
    title: 'Add your first disciple',
    description: 'Start tracking discipleship journeys',
    completed: false,
    href: ROUTES.DASHBOARD,
  },
]

const recentActivity = [
  {
    title: 'Account created',
    description: 'Welcome to Disciple Metrics!',
    time: 'Just now',
  },
]

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
}

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
}

export default function DashboardPage() {
  const { data: profile, isLoading } = useProfile()

  const firstName = profile?.first_name || 'there'

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-2"
      >
        <h1 className="text-2xl font-bold tracking-tight">
          {isLoading ? (
            <Skeleton className="h-8 w-48" />
          ) : (
            `Welcome back, ${firstName}!`
          )}
        </h1>
        <p className="text-muted-foreground">
          Here&apos;s an overview of your discipleship metrics.
        </p>
      </motion.div>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
      >
        {stats.map((stat) => (
          <motion.div key={stat.title} variants={item}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <div className={cn('p-2 rounded-lg', stat.bgColor)}>
                  <stat.icon className={cn('h-4 w-4', stat.color)} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      <div className="grid gap-6 md:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-accent" />
                Getting Started
              </CardTitle>
              <CardDescription>
                Complete these steps to get the most out of Disciple Metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {gettingStarted.map((step, index) => (
                  <Link
                    key={index}
                    href={step.href}
                    className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent transition-colors group"
                  >
                    {step.completed ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p
                        className={cn(
                          'text-sm font-medium',
                          step.completed && 'line-through text-muted-foreground'
                        )}
                      >
                        {step.title}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {step.description}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                Recent Activity
              </CardTitle>
              <CardDescription>
                Your latest actions and updates
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recentActivity.length > 0 ? (
                <div className="space-y-4">
                  {recentActivity.map((activity, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                    >
                      <div className="h-2 w-2 rounded-full bg-primary mt-2" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{activity.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {activity.description}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {activity.time}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p className="text-sm">No recent activity</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
