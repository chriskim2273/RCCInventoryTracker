import { Link } from 'react-router-dom'
import { Heart, Code, Sparkles, Lightbulb, ArrowLeft, Star, MessageCircle, Award } from 'lucide-react'

export default function Credits() {
  const team = [
    {
      name: 'Christopher Kim',
      role: 'Developer',
      icon: Code,
      color: 'from-blue-500 to-cyan-500',
      description: 'Turned caffeine and code into a working inventory system'
    },
    {
      name: 'Sheen Alfred',
      role: 'Orchestrator, Planner, Designer',
      icon: Lightbulb,
      color: 'from-purple-500 to-pink-500',
      description: 'The visionary who made sure everything came together beautifully'
    }
  ]

  const contributors = [
    'Maheen Khan',
    'Rita Luu',
    'Doniyor Vohidjonov',
    'Daniel Gitter',
    'Alissa Burich'
  ]

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center py-8 px-4">
      {/* Back button */}
      <Link
        to="/"
        className="self-start mb-8 flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Link>

      {/* Header with sparkles */}
      <div className="text-center mb-12 relative">
        <div className="absolute -top-4 -left-4 animate-pulse">
          <Sparkles className="h-6 w-6 text-yellow-500" />
        </div>
        <div className="absolute -top-2 -right-6 animate-pulse delay-300">
          <Star className="h-5 w-5 text-yellow-400" />
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent mb-4">
          Meet the Team
        </h1>
        <p className="text-muted-foreground text-lg">
          The people who made this happen
        </p>
      </div>

      {/* Team cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl w-full mb-12">
        {team.map((member, index) => (
          <div
            key={member.name}
            className="group bg-card border rounded-2xl p-6 hover:shadow-lg hover:scale-[1.02] transition-all duration-300 relative overflow-hidden"
          >
            {/* Gradient blob background */}
            <div className={`absolute -top-10 -right-10 w-32 h-32 bg-gradient-to-br ${member.color} opacity-10 rounded-full blur-2xl group-hover:opacity-20 transition-opacity`} />

            <div className="relative">
              {/* Icon */}
              <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${member.color} mb-4`}>
                <member.icon className="h-6 w-6 text-white" />
              </div>

              {/* Name and role */}
              <h2 className="text-xl font-bold mb-1">{member.name}</h2>
              <p className={`text-sm font-medium bg-gradient-to-r ${member.color} bg-clip-text text-transparent mb-3`}>
                {member.role}
              </p>

              {/* Fun description */}
              <p className="text-sm text-muted-foreground">
                {member.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Contributors section */}
      <div className="max-w-3xl w-full mb-8">
        <div className="bg-card border rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute -top-8 -right-8 w-24 h-24 bg-gradient-to-br from-green-500 to-emerald-500 opacity-10 rounded-full blur-2xl" />

          <div className="flex items-center gap-3 mb-4">
            <div className="inline-flex p-2 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500">
              <MessageCircle className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-xl font-bold">Feedback & Support</h2>
          </div>

          <p className="text-sm text-muted-foreground mb-4">
            Huge thanks to these amazing people who provided valuable feedback and helped make this app better:
          </p>

          <div className="flex flex-wrap gap-2 items-center">
            {contributors.map((name) => (
              <span
                key={name}
                className="inline-flex items-center px-3 py-1.5 bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-full text-sm font-medium"
              >
                {name}
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 rounded-full text-sm font-medium text-emerald-700 dark:text-emerald-300">
              <span>+</span>
              <span>RCC Staff of 2025</span>
              <Heart className="h-3 w-3 fill-current" />
            </span>
          </div>
        </div>
      </div>

      {/* Special thanks */}
      <div className="max-w-3xl w-full mb-8">
        <div className="bg-gradient-to-r from-amber-500/10 via-yellow-500/10 to-orange-500/10 border border-amber-500/20 rounded-2xl p-6 text-center relative overflow-hidden">
          <div className="absolute top-2 left-4 animate-pulse">
            <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
          </div>
          <div className="absolute top-3 right-6 animate-pulse delay-150">
            <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
          </div>
          <div className="absolute bottom-3 left-8 animate-pulse delay-300">
            <Star className="h-3 w-3 text-orange-500 fill-orange-500" />
          </div>

          <div className="inline-flex p-3 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 mb-4">
            <Award className="h-6 w-6 text-white" />
          </div>

          <h2 className="text-xl font-bold mb-2">Special Thanks</h2>
          <p className="text-lg font-semibold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent mb-2">
            Priscilla Castellano
          </p>
          <p className="text-sm text-muted-foreground">
            For her hard work and dedication in managing the centers.
            <br />
            This app wouldn't exist without her leadership.
          </p>
        </div>
      </div>

      {/* Our story section */}
      <div className="max-w-3xl w-full bg-card border rounded-2xl p-8 relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-4 right-4">
          <Heart className="h-5 w-5 text-red-400 animate-pulse" />
        </div>

        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <span>Our Story</span>
          <Sparkles className="h-5 w-5 text-yellow-500" />
        </h2>

        <div className="space-y-4 text-muted-foreground leading-relaxed">
          <p>
            We were both students at the Residential Community Center, where we witnessed firsthand
            the chaos of inventory management.
          </p>

          <p>
            Tracking equipment was always a headache. Where are the HDMI cables? Where did that
            toolkit go? Is this item checked out or just missing? The maze of the current system was real.
          </p>

          <p>
            So we decided to build something better. Something that actually makes sense.
            Something that future RCC students and staff can use without wanting to pull their hair out.
          </p>

          <p className="font-medium text-foreground">
            This app is our gift to the center that gave us so much.
          </p>
        </div>

        {/* Footer decoration */}
        <div className="mt-6 pt-6 border-t border-dashed flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <span>Made with</span>
          <Heart className="h-4 w-4 text-red-500 fill-red-500" />
          <span>at Stony Brook University</span>
        </div>
      </div>

      {/* Fun footer */}
      <div className="mt-12 text-center text-sm text-muted-foreground">
        <p className="flex items-center justify-center gap-2">
          <span>RCC Inventory Tracker</span>
          <span className="text-muted-foreground/50">|</span>
          <span>2025</span>
        </p>
        <p className="mt-2 text-xs opacity-75">
          No Google Sheets were harmed in the making of this app
        </p>
      </div>
    </div>
  )
}
