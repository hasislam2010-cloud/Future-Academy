import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { BookOpen, Sparkles, GraduationCap, Globe, Brain, Users } from 'lucide-react';
import { cn } from '@/src/lib/utils';

const GRADES = [
  'Grade 1-3', 'Grade 4-6', 'Grade 7-9', 'High School', 'Undergrad', 'Masters', 'PhD'
];

const TOPICS = [
  { name: 'History', icon: BookOpen },
  { name: 'Geography', icon: Globe },
  { name: 'Civics', icon: Users },
  { name: 'Economics', icon: Sparkles },
  { name: 'Sociology', icon: Users },
  { name: 'Political Science', icon: BookOpen },
  { name: 'Anthropology', icon: Brain },
  { name: 'Psychology', icon: Brain },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const [selectedGrade, setSelectedGrade] = useState(GRADES[3]);
  const [selectedTopic, setSelectedTopic] = useState(TOPICS[0].name);

  const handleStart = async () => {
    if ((window as any).aistudio) {
      const hasKey = await (window as any).aistudio.hasSelectedApiKey();
      if (!hasKey) {
        await (window as any).aistudio.openSelectKey();
      }
    }
    navigate(`/tutor?grade=${encodeURIComponent(selectedGrade)}&topic=${encodeURIComponent(selectedTopic)}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-indigo-200">
      {/* Navigation */}
      <nav className="fixed w-full z-50 bg-white/80 backdrop-blur-md border-b border-indigo-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-indigo-950 tracking-tight">Future Academy</span>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="pt-32 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 font-medium text-sm mb-6 border border-emerald-100">
              <Sparkles className="w-4 h-4" />
              Meet Dr. Sam, Your AI Social Science Tutor
            </span>
            <h1 className="text-5xl sm:text-6xl font-extrabold text-indigo-950 tracking-tight mb-6 leading-tight">
              Master the Human Story with <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">Future Academy</span>
            </h1>
            <p className="text-lg text-slate-600 mb-10 leading-relaxed">
              Experience magical, seamless learning. Dr. Sam explains complex topics through real-time voice, interactive text, and stunning visual simulations.
            </p>
          </motion.div>

          {/* Configuration Card */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="bg-white p-8 rounded-3xl shadow-xl shadow-indigo-900/5 border border-indigo-50"
          >
            <div className="grid md:grid-cols-2 gap-8 text-left mb-8">
              {/* Grade Selector */}
              <div>
                <label className="block text-sm font-semibold text-indigo-950 mb-3 uppercase tracking-wider">
                  Select Your Level
                </label>
                <div className="flex flex-wrap gap-2">
                  {GRADES.map((grade) => (
                    <button
                      key={grade}
                      onClick={() => setSelectedGrade(grade)}
                      className={cn(
                        "px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200",
                        selectedGrade === grade 
                          ? "bg-indigo-600 text-white shadow-md shadow-indigo-200" 
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      )}
                    >
                      {grade}
                    </button>
                  ))}
                </div>
              </div>

              {/* Topic Selector */}
              <div>
                <label className="block text-sm font-semibold text-indigo-950 mb-3 uppercase tracking-wider">
                  Choose a Subject
                </label>
                <div className="flex flex-wrap gap-2">
                  {TOPICS.map((topic) => {
                    const Icon = topic.icon;
                    return (
                      <button
                        key={topic.name}
                        onClick={() => setSelectedTopic(topic.name)}
                        className={cn(
                          "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200",
                          selectedTopic === topic.name 
                            ? "bg-emerald-500 text-white shadow-md shadow-emerald-200" 
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        )}
                      >
                        <Icon className="w-4 h-4" />
                        {topic.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <button
              onClick={handleStart}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-lg font-bold shadow-lg shadow-indigo-200 hover:shadow-xl hover:shadow-indigo-300 hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-center gap-2"
            >
              Start Learning with Dr. Sam
              <Sparkles className="w-5 h-5" />
            </button>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
