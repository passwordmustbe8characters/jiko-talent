import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

// Skill chips shown on the form. Keep labels free of commas (they are joined with commas on submit).
const SKILL_GROUPS = {
  Frontend: ['JavaScript', 'TypeScript', 'React', 'Next.js', 'Vue', 'HTML/CSS', 'Tailwind CSS'],
  Backend: ['Node.js', 'Express', 'Python', 'Django', 'Flask', 'FastAPI', 'Java', 'Spring Boot', 'C#/.NET', 'PHP', 'Laravel', 'Go', 'REST APIs'],
  Databases: ['SQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'Firebase'],
  Mobile: ['Flutter', 'React Native', 'Kotlin', 'Swift', 'Android'],
  'Data & AI': ['Machine Learning', 'Deep Learning', 'Computer Vision', 'NLP', 'Data Analysis', 'Pandas/NumPy', 'Power BI/Tableau', 'Excel'],
  'Cloud, Security & Systems': ['Docker', 'AWS', 'Linux', 'Git/GitHub', 'CI/CD', 'Networking', 'Cybersecurity', 'Embedded/IoT'],
  Design: ['UI/UX Design', 'Figma', 'Graphic Design'],
};

const EMPTY_FORM = {
  matricNumber: '', name: '', email: '', whatsappNumber: '',
  roleInProject: '', isGroupProject: '', projectTitle: '',
  driveLink: '', githubLink: '',
  skills: '',        // combined text sent to the backend, e.g. "React, Node.js, Rust"
  skillsPicked: [],  // chips the student tapped
  skillsOther: '',   // anything typed in "Anything else?"
  shareConsent: ''   // 'Yes' or 'No'
};

const combineSkills = (picked, other) =>
  [...picked, ...other.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean)].join(', ');

function SkillPicker({ picked, other, onChange, onEnter }) {
  const toggle = (skill) =>
    onChange(picked.includes(skill) ? picked.filter((s) => s !== skill) : [...picked, skill], other);

  return (
    <div className="space-y-6">
      {Object.entries(SKILL_GROUPS).map(([group, skills]) => (
        <div key={group}>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{group}</p>
          <div className="flex flex-wrap gap-2">
            {skills.map((skill) => (
              <button
                type="button"
                key={skill}
                onClick={() => toggle(skill)}
                className={`px-4 py-2 rounded-full border-2 text-sm font-bold transition-all cursor-pointer ${
                  picked.includes(skill)
                    ? 'border-rose-900 bg-rose-50 text-rose-900'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                {skill}
              </button>
            ))}
          </div>
        </div>
      ))}
      <div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Anything else?</p>
        <input
          type="text"
          value={other}
          onChange={(e) => onChange(picked, e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onEnter && onEnter()}
          placeholder="e.g., Rust, Unity, Solidity (separate with commas)"
          className="w-full text-lg bg-transparent border-b-2 border-slate-300 py-2 focus:outline-none focus:border-rose-900 transition-colors font-['Alan_Sans',_sans-serif] text-slate-900 placeholder-slate-300"
        />
      </div>
    </div>
  );
}

export default function Apply() {
  const [searchParams] = useSearchParams();
  const teamGroupId = searchParams.get('groupId'); 
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState(() => {
    const saved = localStorage.getItem('jiko_currentStep');
    return saved !== null ? JSON.parse(saved) : 0;
  });

  const [formData, setFormData] = useState(() => {
    const saved = localStorage.getItem('jiko_formData');
    return saved !== null ? { ...EMPTY_FORM, ...JSON.parse(saved) } : EMPTY_FORM;
  });

  const [isReviewing, setIsReviewing] = useState(() => {
    const saved = localStorage.getItem('jiko_isReviewing');
    return saved !== null ? JSON.parse(saved) : false;
  });

  // NEW: Tracks which specific field is currently being edited inline
  const [editingField, setEditingField] = useState(null);

  const [submitState, setSubmitState] = useState('idle'); 
  const [errorMessage, setErrorMessage] = useState('');
  const [generatedGroupId, setGeneratedGroupId] = useState(null);

  const updateSkills = (picked, other) =>
    setFormData((prev) => ({ ...prev, skillsPicked: picked, skillsOther: other, skills: combineSkills(picked, other) }));

  const isAnswered = (q) => (q.type === 'skills' ? formData.skills.trim().length > 0 : Boolean(formData[q.id]));

  useEffect(() => {
    localStorage.setItem('jiko_currentStep', JSON.stringify(currentStep));
    localStorage.setItem('jiko_formData', JSON.stringify(formData));
    localStorage.setItem('jiko_isReviewing', JSON.stringify(isReviewing));
  }, [currentStep, formData, isReviewing]);

  const questions = [
    { id: 'matricNumber', question: "What is your Matriculation Number?", type: "text", placeholder: "e.g., 2022/244823" },
    { id: 'name', question: "What is your full name?", type: "text", placeholder: "As it appears on your project" },
    { id: 'email', question: "What is your email address?", type: "email", placeholder: "you@example.com" },
    { id: 'whatsappNumber', question: "What is your WhatsApp number?", type: "tel", placeholder: "e.g., +234..." },
    { id: 'roleInProject', question: "What was your exact role on this project?", type: "text", placeholder: "e.g., Frontend Developer, Data Analyst" }
  ];

  if (!teamGroupId) {
    questions.push({ id: 'isGroupProject', question: "Was this a group project?", type: "radio", options: ["Yes", "No"] });
    questions.push({ id: 'projectTitle', question: "What is the title of your capstone project?", type: "text", placeholder: "Project Title" });
    questions.push({ 
      id: 'driveLink', 
      question: "Paste your Google Drive link.", 
      type: "url", 
      placeholder: "https://drive.google.com/...",
      subtitle: "Please ensure this folder contains your Project Report, Demo Video, and Presentation assets. Make sure link sharing is set to 'Anyone with the link'."
    });
    questions.push({ id: 'githubLink', question: "Link to your GitHub Repository.", type: "url", placeholder: "https://github.com/..." });
  }

  // Asked of everyone, teammates included, so each student's skills are their own
  questions.push({
    id: 'skills',
    question: "Which skills and tools did you personally use on this project?",
    type: "skills",
    subtitle: "Tap everything that applies. You can add anything we missed at the bottom."
  });
  questions.push({
    id: 'shareConsent',
    question: "Can we share your profile with companies that may want to hire you?",
    type: "radio",
    options: ["Yes", "No"],
    subtitle: "We would share your name, project and skills. You can ask us to stop at any time."
  });

  const currentQ = questions[currentStep];

  const handleNext = () => {
    if (!isAnswered(currentQ) && currentQ.type !== 'radio') return;
    if (currentStep < questions.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      setIsReviewing(true);
    }
  };

  const handleBack = () => {
    if (isReviewing) {
      setIsReviewing(false);
    } else if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && isAnswered(currentQ) && currentQ.type !== 'radio') {
      handleNext();
    }
  };

  const submitProfile = async () => {
    setSubmitState('loading');
    setErrorMessage('');
    
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const response = await fetch(`${API_URL}/api/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, teamGroupId })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setSubmitState('success');
        if (data.generatedGroupId) setGeneratedGroupId(data.generatedGroupId);
        localStorage.removeItem('jiko_currentStep');
        localStorage.removeItem('jiko_formData');
        localStorage.removeItem('jiko_isReviewing');
      } else {
        setSubmitState('error');
        setErrorMessage(data.error);
      }
    } catch {
      setSubmitState('error');
      setErrorMessage("Network error. Make sure the backend is running.");
    }
  };

  const copyToClipboard = () => {
    const link = `http://localhost:5173/apply?groupId=${generatedGroupId}`;
    navigator.clipboard.writeText(link);
    alert("Invite link copied to clipboard!");
  };

  // SUCCESS SCREEN
  if (submitState === 'success') {
    return (
      <div className="min-h-screen bg-[#F4F4F0] flex flex-col items-center justify-center p-6 selection:bg-rose-200 text-slate-900">
        <div className="max-w-xl w-full text-center space-y-6">
          <div className="w-20 h-20 bg-rose-900 text-white rounded-full flex items-center justify-center mx-auto shadow-lg shadow-rose-900/30">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-10 h-10">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold font-['Sora',_sans-serif] text-slate-900">Profile Vetted & Saved!</h1>
          <p className="text-lg text-slate-600 font-['Alan_Sans',_sans-serif]">Your capstone project is now officially in the Jiko Talent pool.</p>
          
          {generatedGroupId && (
            <div className="mt-8 p-6 bg-white border border-rose-900/20 rounded-2xl shadow-xl space-y-4">
              <h2 className="text-xl font-bold text-rose-900 font-['Sora',_sans-serif]">Invite Your Teammates</h2>
              <p className="text-sm text-slate-600 font-['Alan_Sans',_sans-serif]">Share this link with your team. They won't need to re-upload the project links!</p>
              <div className="flex items-center gap-2 bg-slate-100 p-3 rounded-lg border border-slate-200 overflow-hidden">
                <span className="text-xs text-slate-500 truncate flex-grow text-left">
                  http://localhost:5173/apply?groupId={generatedGroupId}
                </span>
                <button onClick={copyToClipboard} className="bg-rose-900 text-white px-4 py-2 rounded text-xs font-bold hover:bg-rose-950 transition cursor-pointer flex-shrink-0">
                  Copy Link
                </button>
              </div>
            </div>
          )}

          <button onClick={() => navigate('/')} className="mt-8 text-rose-900 font-bold text-sm hover:underline cursor-pointer">
            Return to Homepage
          </button>
        </div>
      </div>
    );
  }

  // REVIEW SCREEN WITH INLINE EDITING
  if (isReviewing) {
    return (
      <div className="min-h-screen bg-[#F4F4F0] flex flex-col items-center justify-center p-6 selection:bg-rose-200">
        <div className="max-w-3xl w-full">
          <div className="flex items-center mb-8 gap-4">
            <button onClick={handleBack} className="p-2 rounded-full hover:bg-slate-200 transition cursor-pointer text-slate-600">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
            </button>
            <h2 className="text-3xl font-bold font-['Sora',_sans-serif] text-slate-900">Review Profile</h2>
          </div>
          
          {submitState === 'error' && (
            <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-lg text-sm font-medium border border-red-200">
              {errorMessage}
            </div>
          )}

          <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-200">
            <div className="divide-y divide-slate-100">
              {questions.map((q) => (
                <div 
                  key={q.id} 
                  className="flex flex-col md:flex-row md:items-center p-5 group transition-colors hover:bg-slate-50"
                >
                  <div className="w-full md:w-1/3 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 md:mb-0 group-hover:text-rose-900 transition-colors">
                    {q.question}
                  </div>
                  
                  <div className="w-full md:w-2/3 font-medium text-slate-900 text-lg">
                    {editingField === q.id ? (
                      // Inline Editing State
                      q.type === 'skills' ? (
                        <div className="space-y-4 py-2">
                          <SkillPicker
                            picked={formData.skillsPicked}
                            other={formData.skillsOther}
                            onChange={updateSkills}
                            onEnter={() => setEditingField(null)}
                          />
                          <button
                            type="button"
                            onClick={() => setEditingField(null)}
                            className="bg-rose-900 text-white px-6 py-2 rounded-full font-bold text-sm hover:bg-rose-950 transition-colors cursor-pointer"
                          >
                            Done
                          </button>
                        </div>
                      ) : q.type === 'radio' ? (
                        <div className="flex gap-3">
                          {q.options.map(opt => (
                            <button
                              key={opt}
                              onClick={() => {
                                setFormData({ ...formData, [q.id]: opt });
                                setEditingField(null); // Lock it in instantly
                              }}
                              className={`px-4 py-1.5 rounded text-sm font-bold transition-colors ${
                                formData[q.id] === opt ? 'bg-rose-900 text-white' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                              }`}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <input
                          type={q.type}
                          autoFocus
                          value={formData[q.id] || ''}
                          onChange={(e) => setFormData({ ...formData, [q.id]: e.target.value })}
                          onBlur={() => setEditingField(null)} // Click outside to save
                          onKeyDown={(e) => e.key === 'Enter' && setEditingField(null)} // Hit enter to save
                          className="w-full bg-transparent border-b-2 border-rose-900 focus:outline-none py-1 text-slate-900 font-['Alan_Sans',_sans-serif]"
                        />
                      )
                    ) : (
                      // Display State
                      <div 
                        onClick={() => setEditingField(q.id)}
                        className="cursor-pointer hover:bg-slate-100 p-1 -ml-1 rounded transition-colors inline-block min-w-[50%]"
                        title="Click to edit"
                      >
                        {formData[q.id] || <span className="text-slate-300 italic">Empty - tap to add</span>}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button 
            onClick={submitProfile}
            disabled={submitState === 'loading'}
            className="w-full mt-8 bg-rose-900 text-white py-4 rounded-xl font-bold text-lg hover:bg-rose-950 transition-colors shadow-lg shadow-rose-900/20 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {submitState === 'loading' ? 'Verifying & Saving...' : 'Confirm & Submit Profile'}
          </button>
        </div>
      </div>
    );
  }

  // QUESTION FLOW SCREEN
  return (
    <div className="min-h-screen bg-[#F4F4F0] flex flex-col p-6 selection:bg-rose-200 relative">
      <div className="w-full max-w-3xl mx-auto flex items-center gap-4 pt-8 mb-16">
        {currentStep > 0 && (
          <button onClick={handleBack} className="p-2 -ml-2 rounded-full hover:bg-slate-200 transition cursor-pointer text-slate-600 hover:text-rose-900">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
          </button>
        )}
        <div className="h-1 bg-slate-200 flex-grow rounded-full overflow-hidden">
          <div 
            className="h-full bg-rose-900 transition-all duration-500 ease-out"
            style={{ width: `${((currentStep + 1) / questions.length) * 100}%` }}
          ></div>
        </div>
        <span className="text-xs font-bold text-slate-400">{currentStep + 1} / {questions.length}</span>
      </div>

      <div className="flex-grow flex items-center justify-center">
        <div className="max-w-3xl w-full">
          <div className="animate-[fadeIn_0.4s_ease-out_forwards]">
            <h2 className="text-3xl md:text-5xl font-bold font-['Sora',_sans-serif] text-slate-900 mb-2 leading-tight">
              {currentQ.question}
            </h2>
            
            {currentQ.subtitle && (
              <p className="text-slate-500 text-sm md:text-base font-['Alan_Sans',_sans-serif] mb-8 max-w-2xl">
                {currentQ.subtitle}
              </p>
            )}
            
            <div className={`mt-8 ${currentQ.subtitle ? '' : 'mt-12'}`}>
              {currentQ.type === 'radio' ? (
                <div className="flex gap-4">
                  {currentQ.options.map(opt => (
                    <button
                      key={opt}
                      onClick={() => {
                        setFormData({ ...formData, [currentQ.id]: opt });
                        setTimeout(() => {
                          if (currentStep < questions.length - 1) {
                            setCurrentStep(prev => prev + 1);
                          } else {
                            setIsReviewing(true);
                          }
                        }, 200); 
                      }}
                      className={`px-8 py-4 rounded-xl border-2 font-bold text-lg transition-all cursor-pointer ${
                        formData[currentQ.id] === opt 
                          ? 'border-rose-900 bg-rose-50 text-rose-900 shadow-sm' 
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              ) : currentQ.type === 'skills' ? (
                <SkillPicker picked={formData.skillsPicked} other={formData.skillsOther} onChange={updateSkills} onEnter={handleNext} />
              ) : (
                <input 
                  type={currentQ.type}
                  autoFocus
                  placeholder={currentQ.placeholder}
                  value={formData[currentQ.id] || ''}
                  onChange={(e) => setFormData({ ...formData, [currentQ.id]: e.target.value })}
                  onKeyDown={handleKeyDown}
                  className="w-full text-2xl md:text-4xl bg-transparent border-b-2 border-slate-300 py-4 focus:outline-none focus:border-rose-900 transition-colors font-['Alan_Sans',_sans-serif] text-slate-900 placeholder-slate-300"
                />
              )}
            </div>

            {currentQ.type !== 'radio' && (
              <div className="mt-12 flex items-center gap-4">
                <button 
                  onClick={handleNext}
                  disabled={!isAnswered(currentQ)}
                  className="bg-rose-900 text-white px-8 py-3.5 rounded-full font-bold text-sm hover:bg-rose-950 transition-all cursor-pointer disabled:opacity-30 shadow-lg shadow-rose-900/20 disabled:shadow-none"
                >
                  {currentStep === questions.length - 1 ? 'Review' : 'OK'}
                </button>
                <span className="text-xs text-slate-400 font-bold">press Enter ↵</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}