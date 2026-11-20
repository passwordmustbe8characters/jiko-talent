import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Landing() {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isDark, setIsDark] = useState(false);
  const navigate = useNavigate();

  const handleMouseMove = (e) => {
    setMousePos({ x: e.clientX, y: e.clientY });
  };

  return (
    <div>
      <div 
        onMouseMove={handleMouseMove}
        className={`min-h-screen relative overflow-x-hidden selection:bg-rose-200 transition-colors duration-500 flex flex-col ${isDark ? 'bg-[#020617] text-white' : 'bg-[#F4F4F0] text-slate-900'}`}
      >
        <style>
          {`
            @keyframes chaoticMist {
              0% { background-position: 0% 0%; }
              20% { background-position: 100% 100%; }
              40% { background-position: 0% 100%; }
              60% { background-position: 100% 0%; }
              80% { background-position: 50% 50%; }
              100% { background-position: 0% 0%; }
            }
            
            .animate-mist {
              background-size: 200% 200%;
              animation: chaoticMist 10s ease-in-out infinite alternate;
            }

            .hover-mist-dark {
              transition: all 0.4s ease;
              background-size: 300% 300%;
            }
            .hover-mist-dark:hover {
              background-image: linear-gradient(135deg, rgba(30,41,59,0.8), rgba(71,85,105,0.6), rgba(15,23,42,0.9), rgba(51,65,85,0.7));
              animation: chaoticMist 4s ease-in-out infinite alternate;
              color: white !important;
              border-color: transparent !important;
            }

            .hover-mist-light {
              transition: all 0.4s ease;
              background-size: 300% 300%;
            }
            .hover-mist-light:hover {
              /* Changed from purple hues to soft rose/red hues */
              background-image: linear-gradient(135deg, rgba(255,255,255,0.9), rgba(254,226,226,0.5), rgba(255,228,230,0.8), rgba(253,164,175,0.4));
              animation: chaoticMist 4s ease-in-out infinite alternate;
              color: #881337 !important; /* Oxblood Red text on hover */
              border-color: transparent !important;
            }
          `}
        </style>

        {/* Base Subtle Grid */}
        <div className={`fixed inset-0 z-0 bg-[size:40px_40px] opacity-40 transition-colors duration-500 ${isDark ? 'bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)]' : 'bg-[linear-gradient(to_right,#d1d5db_1px,transparent_1px),linear-gradient(to_bottom,#d1d5db_1px,transparent_1px)]'}`}></div>
        
        {/* Interactive Cursor Spotlight Grid */}
        <div 
          className={`fixed inset-0 z-0 pointer-events-none bg-[size:40px_40px] opacity-50 transition-colors duration-500 ${isDark ? 'bg-[linear-gradient(to_right,#475569_1px,transparent_1px),linear-gradient(to_bottom,#475569_1px,transparent_1px)]' : 'bg-[linear-gradient(to_right,#94a3b8_1px,transparent_1px),linear-gradient(to_bottom,#94a3b8_1px,transparent_1px)]'}`}
          style={{
            maskImage: `radial-gradient(circle 350px at ${mousePos.x}px ${mousePos.y}px, black, transparent)`,
            WebkitMaskImage: `radial-gradient(circle 350px at ${mousePos.x}px ${mousePos.y}px, black, transparent)`
          }}
        ></div>

        <div className="relative z-10 flex flex-col min-h-screen">
          
          <div className="pt-6 px-6 fixed top-0 w-full z-50 flex justify-center pointer-events-none">
            <div className="w-full max-w-5xl flex items-center justify-center gap-4">
              
              {/* Navbar now uses rose-900 for the mist gradient and shadow */}
              <nav className="w-full max-w-4xl h-14 px-6 flex items-center justify-between rounded-full bg-gradient-to-r from-black via-slate-800 to-rose-900 animate-mist shadow-lg shadow-rose-900/20 text-white pointer-events-auto border border-white/10">
                <span className="text-xl font-bold tracking-tight font-['Sora',_sans-serif]">
                  Jiko<span className="font-medium text-rose-300">Talent</span>
                </span>
                
                <div className="hidden md:flex gap-8 text-sm font-medium text-slate-300 font-['Alan_Sans',_sans-serif]">
                  <a href="#" className="hover:text-white transition-colors cursor-pointer">Platform</a>
                  <a href="#" className="hover:text-white transition-colors cursor-pointer">Vetting Process</a>
                  <a href="#" className="hover:text-white transition-colors cursor-pointer">For Employers</a>
                </div>
                
                <a href="#hire" className="bg-white text-black px-5 py-2.5 rounded-full text-xs font-bold hover:bg-slate-200 transition-colors font-['Sora',_sans-serif] cursor-pointer">
                  Access Talent
                </a>
              </nav>

              <button 
                onClick={() => setIsDark(!isDark)}
                className={`w-14 h-14 rounded-full border shadow-lg flex items-center justify-center pointer-events-auto hover:scale-105 transition-all cursor-pointer ${isDark ? 'bg-slate-900 border-slate-800 text-yellow-400' : 'bg-white border-slate-200 text-slate-600'}`}
              >
                {isDark ? (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <main className="flex-grow flex flex-col items-center justify-center text-center max-w-screen-2xl mx-auto px-6 pt-32 pb-20 min-h-[85vh] relative w-full">
            
            <div className="relative max-w-4xl w-full z-10">
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-8 leading-[1.1] font-['Sora',_sans-serif]">
                Hire Elite Graduates Before They Hit the Market.
              </h1>
            </div>
            
            <p className={`text-lg md:text-xl mb-12 max-w-2xl leading-relaxed font-['Alan_Sans',_sans-serif] relative z-10 transition-colors duration-500 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              Jiko Talent bridges the gap between innovative companies and top-performing final-year students. We manually vet comprehensive capstone projects across all academic disciplines to ensure you only interview execution-ready talent.
            </p>

            <div className="flex flex-wrap justify-center gap-5 relative z-10">
              <button className={`px-8 py-3.5 rounded-full font-semibold text-sm font-['Sora',_sans-serif] shadow-lg cursor-pointer hover-mist-dark transition-colors ${isDark ? 'bg-white text-slate-900 shadow-white/10' : 'bg-slate-900 text-white shadow-slate-900/20'}`}>
                Request Talent Match
              </button>
              
              <button 
                onClick={() => navigate('/apply')}
                className={`bg-transparent border px-8 py-3.5 rounded-full font-semibold text-sm font-['Sora',_sans-serif] cursor-pointer hover-mist-light transition-all ${isDark ? 'text-white border-slate-600 hover:bg-slate-800' : 'text-slate-900 border-slate-300 hover:bg-white'}`}
              >
                Submit Student Profile
              </button>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}