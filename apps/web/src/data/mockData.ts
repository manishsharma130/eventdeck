export type EventTag = 'Firebase Analytics' | 'Google Analytics' | 'MoEngage'

export interface AnalyticsEvent {
  id: number
  name: string
  timestamp: string
  tag: EventTag
  params: Record<string, string | boolean>
}

const names = [
  'app_open', 'screen_view', 'button_click', 'add_to_cart', 'view_item',
  'begin_checkout', 'purchase', 'user_properties_set', 'app_background', 'app_foreground',
]
const tags: EventTag[] = ['Firebase Analytics', 'Google Analytics', 'MoEngage']

export const events: AnalyticsEvent[] = Array.from({ length: 128 }, (_, index) => ({
  id: index + 1,
  name: names[index % names.length],
  timestamp: `Apr 26, 2024  10:24:${String(18 + (index % 42)).padStart(2, '0')}.${String(432 + index).slice(-3)}`,
  tag: tags[index % tags.length],
  params: {
    app_version: '1.4.0',
    platform: 'ios',
    device_model: 'iPhone 15 Pro',
    os_version: '17.4.1',
    locale: 'en_US',
    is_first_open: index === 0,
    referrer: 'organic',
  },
}))

export const eventDefinitions = [
  ['app_open', 3], ['screen_view', 2], ['button_click', 1], ['add_to_cart', 2],
  ['purchase', 4], ['begin_checkout', 0], ['view_item', 1], ['user_properties_set', 0],
  ['subscription_activated', 2], ['app_background', 0],
] as const

export const flows = [
  ['Purchase Flow', 12, 'cart'], ['User Onboarding Flow', 8, 'user'],
  ['Payment Flow', 10, 'card'], ['Marketing Campaign Flow', 6, 'megaphone'],
  ['User Engagement Flow', 14, 'heart'], ['Product Analytics Flow', 9, 'box'],
  ['Content Flow', 7, 'file'], ['Loyalty Program Flow', 11, 'star'],
] as const

export type ExecutionStatus = 'passed' | 'progress' | 'pending' | 'failed'

export interface ExecutionFlow {
  id: number
  name: string
  overall: 'running' | 'failed'
  events: { name: string; status: ExecutionStatus }[]
}

const largeValidationEvents: ExecutionFlow['events'] = Array.from({ length: 1500 }, (_, index) => ({
  name: `validation_event_${String(index + 1).padStart(4, '0')}`,
  status: index < 1100 ? 'passed' : 'failed',
}))

export const executionFlows: ExecutionFlow[] = [
  {
    id: 6,
    name: 'Large Validation Flow',
    overall: 'failed',
    events: largeValidationEvents,
  },
  {
    id: 1,
    name: 'Zomato Premium+',
    overall: 'running',
    events: [
      { name: 'app_open', status: 'passed' },
      { name: 'premium_subscription_plan_selected', status: 'passed' },
      { name: 'view_details', status: 'passed' },
      { name: 'add_payment_info', status: 'passed' },
      { name: 'purchase_confirmed', status: 'progress' },
      { name: 'subscription_activated', status: 'pending' },
    ],
  },
  {
    id: 2,
    name: 'Checkout Flow',
    overall: 'failed',
    events: [
      { name: 'app_open', status: 'passed' },
      { name: 'view_item', status: 'passed' },
      { name: 'add_to_cart', status: 'passed' },
      { name: 'begin_checkout', status: 'failed' },
      { name: 'add_payment_info', status: 'pending' },
      { name: 'purchase', status: 'pending' },
      { name: 'purchase_confirmed', status: 'pending' },
    ],
  },
  {
    id: 3,
    name: 'User Onboarding Flow',
    overall: 'running',
    events: [
      { name: 'app_open', status: 'passed' },
      { name: 'welcome_screen_viewed', status: 'passed' },
      { name: 'signup_started', status: 'passed' },
      { name: 'email_submitted', status: 'passed' },
      { name: 'otp_requested', status: 'passed' },
      { name: 'otp_verified', status: 'passed' },
      { name: 'profile_started', status: 'passed' },
      { name: 'name_submitted', status: 'passed' },
      { name: 'preferences_opened', status: 'passed' },
      { name: 'preference_selected', status: 'progress' },
      { name: 'notifications_prompted', status: 'pending' },
      { name: 'notifications_enabled', status: 'pending' },
      { name: 'tutorial_started', status: 'pending' },
      { name: 'tutorial_completed', status: 'pending' },
      { name: 'home_screen_viewed', status: 'pending' },
      { name: 'onboarding_completed', status: 'pending' },
    ],
  },
  {
    id: 4,
    name: 'Payment Verification Flow',
    overall: 'running',
    events: [
      { name: 'checkout_opened', status: 'passed' },
      { name: 'payment_method_selected', status: 'passed' },
      { name: 'billing_address_added', status: 'passed' },
      { name: 'payment_submitted', status: 'progress' },
      { name: 'payment_verified', status: 'pending' },
      { name: 'receipt_generated', status: 'pending' },
    ],
  },
  {
    id: 5,
    name: 'Content Engagement Flow',
    overall: 'failed',
    events: [
      { name: 'feed_opened', status: 'passed' },
      { name: 'content_impression', status: 'passed' },
      { name: 'content_opened', status: 'passed' },
      { name: 'video_started', status: 'passed' },
      { name: 'video_progress_25', status: 'passed' },
      { name: 'video_progress_50', status: 'failed' },
      { name: 'video_progress_75', status: 'pending' },
      { name: 'video_completed', status: 'pending' },
      { name: 'content_shared', status: 'pending' },
    ],
  },
]
