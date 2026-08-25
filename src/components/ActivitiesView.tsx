import React, { useState } from 'react';
import { 
  Activity, 
  ThumbsUp, 
  ThumbsDown, 
  HelpCircle, 
  Calendar, 
  Clock, 
  Award, 
  CheckCircle, 
  XCircle, 
  Plus, 
  Trash2,
  Sparkles,
  BookOpen,
  Vote as VoteIcon,
  User
} from 'lucide-react';
import { ActivityTraining, Officer, QuizQuestion } from '../types';

interface ActivitiesViewProps {
  currentUser: Officer;
  activities: ActivityTraining[];
  onVote: (activityId: string, voteType: 'up' | 'down') => void;
  onSubmitQuiz: (activityId: string, answers: Record<number, number>) => Promise<any>;
  onCreateActivity?: (data: Partial<ActivityTraining>) => void;
}

export const ActivitiesView: React.FC<ActivitiesViewProps> = ({
  currentUser,
  activities,
  onVote,
  onSubmitQuiz,
  onCreateActivity,
}) => {
  const [selectedActivityForQuiz, setSelectedActivityForQuiz] = useState<ActivityTraining | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizResult, setQuizResult] = useState<any>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // New activity form states
  const [activityType, setActivityType] = useState<'quiz' | 'vote'>('vote');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  
  // Default end time: 3 days from now at 23:59
  const getDefaultEndTime = () => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    const dateStr = d.toISOString().split('T')[0];
    return `${dateStr} 23:59`;
  };
  
  const [endTime, setEndTime] = useState(getDefaultEndTime());

  // Questions state for 'quiz' type
  const [questions, setQuestions] = useState<Array<{
    question: string;
    options: string[];
    correct_index: number;
    explanation: string;
  }>>([
    {
      question: '',
      options: ['', '', '', ''],
      correct_index: 0,
      explanation: ''
    }
  ]);

  const isLeaderOrAdmin = currentUser.role === 'Leader' || currentUser.role === 'Admin';

  const handleOpenQuiz = (act: ActivityTraining) => {
    setSelectedActivityForQuiz(act);
    setQuizAnswers({});
    setQuizResult(act.quiz?.submissions[currentUser.discord_id] || null);
  };

  const handleSelectAnswer = (questionId: number, optionIndex: number) => {
    setQuizAnswers(prev => ({ ...prev, [questionId]: optionIndex }));
  };

  const handleSubmitQuizAnswers = async () => {
    if (!selectedActivityForQuiz || !selectedActivityForQuiz.quiz) return;
    const res = await onSubmitQuiz(selectedActivityForQuiz.id, quizAnswers);
    setQuizResult(res);
  };

  const handleAddQuestion = () => {
    setQuestions(prev => [
      ...prev,
      {
        question: '',
        options: ['', '', '', ''],
        correct_index: 0,
        explanation: ''
      }
    ]);
  };

  const handleRemoveQuestion = (index: number) => {
    if (questions.length <= 1) return;
    setQuestions(prev => prev.filter((_, i) => i !== index));
  };

  const handleQuestionChange = (index: number, field: string, val: any) => {
    setQuestions(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: val };
      return updated;
    });
  };

  const handleOptionChange = (qIndex: number, optIndex: number, val: string) => {
    setQuestions(prev => {
      const updated = [...prev];
      const newOpts = [...updated[qIndex].options];
      newOpts[optIndex] = val;
      updated[qIndex] = { ...updated[qIndex], options: newOpts };
      return updated;
    });
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onCreateActivity) return;

    const payload: Partial<ActivityTraining> = {
      title,
      activity_type: activityType,
      category: activityType === 'quiz' ? 'SOP Quiz' : 'Vote',
      description,
      end_time: endTime || getDefaultEndTime(),
      scheduled_time: endTime || getDefaultEndTime(),
    };

    if (activityType === 'quiz') {
      // Validate and clean questions
      const validQuestions: QuizQuestion[] = questions
        .filter(q => q.question.trim().length > 0)
        .map((q, idx) => ({
          id: idx + 1,
          question: q.question.trim(),
          options: q.options.map((opt, oIdx) => opt.trim() || `ตัวเลือกที่ ${oIdx + 1}`),
          correct_index: q.correct_index,
          explanation: q.explanation.trim() || undefined
        }));

      if (validQuestions.length > 0) {
        payload.quiz = {
          questions: validQuestions,
          submissions: {}
        };
      }
    }

    onCreateActivity(payload);
    setShowCreateModal(false);
    
    // Reset form
    setTitle('');
    setDescription('');
    setEndTime(getDefaultEndTime());
    setQuestions([
      {
        question: '',
        options: ['', '', '', ''],
        correct_index: 0,
        explanation: ''
      }
    ]);
  };

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="bento-card bento-card-gold p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-amber-400 text-xs font-black uppercase tracking-wider mb-1">
            <Activity className="w-4 h-4" />
            <span>OPERATIONAL ACTIVITIES & SOP SYSTEM</span>
          </div>
          <h2 className="text-xl font-black text-white">กิจกรรมถาม-ตอบ SOP & ระบบเปิดโหวตมติ</h2>
          <p className="text-xs text-slate-400 mt-1">
            สร้างและเข้าร่วมแบบทดสอบความรู้มาตรฐานตำรวจ หรือลงคะแนนโหวตมติและแผนงานในสถานี
          </p>
        </div>

        {isLeaderOrAdmin && onCreateActivity && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs shadow-lg shadow-amber-950/40 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>สร้างกิจกรรมใหม่</span>
          </button>
        )}
      </div>

      {/* Activities Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {activities.map((act) => {
          const userVote = act.votes?.user_votes?.[currentUser.discord_id];
          const isQuiz = act.activity_type === 'quiz' || act.category === 'SOP Quiz' || (act.quiz && act.quiz.questions.length > 0);
          const hasQuizData = act.quiz && act.quiz.questions.length > 0;
          const userSubmission = act.quiz?.submissions?.[currentUser.discord_id];
          const displayDeadline = act.end_time || act.scheduled_time || 'ไม่ระบุ';

          return (
            <div
              key={act.id}
              className={`bento-card p-5 transition-all space-y-4 shadow-xl flex flex-col justify-between ${
                isQuiz ? 'bento-card-gold' : 'bento-card-blue'
              }`}
            >
              <div className="space-y-3">
                {/* Badge Type & Deadline */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className={`px-2.5 py-1 rounded-xl text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                    isQuiz
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  }`}>
                    {isQuiz ? (
                      <>
                        <HelpCircle className="w-3 h-3 text-amber-400" />
                        <span>แบบถาม-ตอบ (SOP Quiz)</span>
                      </>
                    ) : (
                      <>
                        <VoteIcon className="w-3 h-3 text-cyan-400" />
                        <span>แบบเปิดโหวต (Open Vote)</span>
                      </>
                    )}
                  </span>

                  <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1 bg-slate-950/60 px-2 py-0.5 rounded-lg border border-slate-800">
                    <Clock className="w-3 h-3 text-amber-400" />
                    <span>สิ้นสุด: {displayDeadline}</span>
                  </span>
                </div>

                <h3 className="text-base font-bold text-white hover:text-amber-300 transition-colors">
                  {act.title}
                </h3>

                <p className="text-xs text-slate-300 leading-relaxed">
                  {act.description}
                </p>

                <div className="flex items-center space-x-2 text-xs text-slate-400 pt-1">
                  <span className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-slate-500" /> โดย {act.creator_name}
                  </span>
                  {hasQuizData && (
                    <>
                      <span>&bull;</span>
                      <span className="text-amber-400 font-medium">
                        {act.quiz?.questions.length} ข้อคำถาม
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Action Bar: Voting & Quiz Trigger */}
              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                {/* Upvote & Downvote Poll */}
                <div className="flex items-center space-x-1 bg-slate-950 px-2 py-1 rounded-xl border border-slate-800">
                  <button
                    onClick={() => onVote(act.id, 'up')}
                    className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs transition-colors cursor-pointer ${
                      userVote === 'up' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-400 hover:text-emerald-300'
                    }`}
                    title="โหวตเห็นด้วย / สนับสนุน"
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                    <span>{act.votes?.up || 0}</span>
                  </button>

                  <button
                    onClick={() => onVote(act.id, 'down')}
                    className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs transition-colors cursor-pointer ${
                      userVote === 'down' ? 'bg-rose-600 text-white font-bold' : 'text-slate-400 hover:text-rose-300'
                    }`}
                    title="โหวตไม่เห็นด้วย / คัดค้าน"
                  >
                    <ThumbsDown className="w-3.5 h-3.5" />
                    <span>{act.votes?.down || 0}</span>
                  </button>
                </div>

                {/* Quiz CTA */}
                {hasQuizData && (
                  <button
                    onClick={() => handleOpenQuiz(act)}
                    className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition-all cursor-pointer shadow-sm"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>
                      {userSubmission ? `ผลสอบ: ${userSubmission.score}/${userSubmission.max_score || act.quiz?.questions.length}` : 'ทำแบบทดสอบ SOP'}
                    </span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Interactive Quiz Modal */}
      {selectedActivityForQuiz && selectedActivityForQuiz.quiz && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0e1626] border border-slate-700 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-amber-400" />
                  แบบทดสอบระเบียบ & SOP: {selectedActivityForQuiz.title}
                </h3>
                <p className="text-[11px] text-slate-400">ตอบคำถามเพื่อรับการประเมินความพร้อมและบันทึกคะแนนในระบบ</p>
              </div>
              <button onClick={() => setSelectedActivityForQuiz(null)} className="text-slate-400 hover:text-white p-1">✕</button>
            </div>

            {/* Questions List */}
            <div className="space-y-4">
              {selectedActivityForQuiz.quiz.questions.map((q, qIndex) => {
                const selected = quizAnswers[q.id];
                const isSubmitted = !!quizResult;
                const isCorrect = isSubmitted && selected === q.correct_index;

                return (
                  <div key={q.id} className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2.5 text-xs">
                    <p className="font-bold text-white">
                      ข้อ {qIndex + 1}: {q.question}
                    </p>

                    <div className="space-y-1.5">
                      {q.options.map((opt, optIdx) => {
                        let btnStyle = "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-600";
                        if (selected === optIdx) {
                          btnStyle = "bg-amber-500/20 border-amber-500 text-amber-300 font-bold";
                        }
                        if (isSubmitted) {
                          if (optIdx === q.correct_index) {
                            btnStyle = "bg-emerald-950/80 border-emerald-500 text-emerald-300 font-bold";
                          } else if (selected === optIdx) {
                            btnStyle = "bg-rose-950/80 border-rose-500 text-rose-300";
                          }
                        }

                        return (
                          <button
                            key={optIdx}
                            type="button"
                            disabled={isSubmitted}
                            onClick={() => handleSelectAnswer(q.id, optIdx)}
                            className={`w-full text-left px-3 py-2 rounded-lg border text-xs transition-all cursor-pointer ${btnStyle}`}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>

                    {isSubmitted && q.explanation && (
                      <p className="text-[11px] text-amber-400 bg-amber-950/20 p-2 rounded border border-amber-800/40 mt-1">
                        คำอธิบาย: {q.explanation}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Result / Submit footer */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
              {quizResult ? (
                <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4" />
                  <span>คะแนนของคุณ: {quizResult.score} / {quizResult.max_score || selectedActivityForQuiz.quiz.questions.length} ({Math.round(((quizResult.score) / (quizResult.max_score || selectedActivityForQuiz.quiz.questions.length)) * 100)}%)</span>
                </div>
              ) : (
                <span className="text-[11px] text-slate-500">ตอบให้ครบทุกข้อก่อนกดส่ง</span>
              )}

              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => setSelectedActivityForQuiz(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700 cursor-pointer"
                >
                  ปิด
                </button>
                {!quizResult && (
                  <button
                    type="button"
                    onClick={handleSubmitQuizAnswers}
                    disabled={Object.keys(quizAnswers).length < selectedActivityForQuiz.quiz.questions.length}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-md disabled:opacity-40 cursor-pointer"
                  >
                    ส่งคำตอบตรวจคะแนน
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Activity Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0e1626] border border-slate-700 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-amber-400" />
                สร้างกิจกรรมใหม่
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white p-1">✕</button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
              {/* Option Selector: แบบถาม-ตอบ VS แบบเปิดโหวต */}
              <div>
                <label className="block text-slate-300 font-bold mb-2">เลือกประเภทกิจกรรม</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setActivityType('quiz')}
                    className={`p-3.5 rounded-xl border flex flex-col items-center gap-1.5 transition-all text-center cursor-pointer ${
                      activityType === 'quiz'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold shadow-lg shadow-amber-950/30'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <HelpCircle className={`w-5 h-5 ${activityType === 'quiz' ? 'text-amber-400' : 'text-slate-500'}`} />
                    <span className="text-xs">แบบถาม-ตอบ</span>
                    <span className="text-[10px] text-slate-500 font-normal">สร้างชุดแบบทดสอบ SOP & ประเมินความรู้</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActivityType('vote')}
                    className={`p-3.5 rounded-xl border flex flex-col items-center gap-1.5 transition-all text-center cursor-pointer ${
                      activityType === 'vote'
                        ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 font-bold shadow-lg shadow-cyan-950/30'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <VoteIcon className={`w-5 h-5 ${activityType === 'vote' ? 'text-cyan-400' : 'text-slate-500'}`} />
                    <span className="text-xs">แบบเปิดโหวต</span>
                    <span className="text-[10px] text-slate-500 font-normal">เปิดรับคะแนนโหวตมติ & แผนปฏิบัติการ</span>
                  </button>
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-slate-300 font-bold mb-1">
                  {activityType === 'quiz' ? 'ชื่อแบบทดสอบ / หัวข้อคำถาม' : 'หัวข้อการโหวต / ชื่อภารกิจ'}
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={activityType === 'quiz' ? 'เช่น แบบทดสอบระเบียบการใช้อาวุธ Class 3 หรือ ยุทธวิธี 10-80' : 'เช่น โหวตรับรองแผนปฏิบัติการ Operation Dark Harbor'}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-slate-300 font-bold mb-1">รายละเอียดกิจกรรม</label>
                <textarea
                  rows={2}
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="วัตถุประสงค์, ข้อกำหนด, และรายละเอียดสำหรับเจ้าหน้าที่..."
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* End Time (วัน-เวลาที่สิ้นสุดกิจกรรม) */}
              <div>
                <label className="block text-slate-300 font-bold mb-1 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>วัน-เวลาที่สิ้นสุดกิจกรรม</span>
                </label>
                <input
                  type="text"
                  required
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  placeholder="เช่น 2026-08-28 23:59"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500 font-mono"
                />
                <p className="text-[10px] text-slate-500 mt-1">กำหนดวันและเวลาปิดรับคำตอบหรือสิ้นสุดการลงคะแนนโหวต</p>
              </div>

              {/* Quiz Questions Builder (Only if activityType === 'quiz') */}
              {activityType === 'quiz' && (
                <div className="pt-2 border-t border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-400 flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4" />
                      รายการข้อคำถาม ({questions.length} ข้อ)
                    </span>
                    <button
                      type="button"
                      onClick={handleAddQuestion}
                      className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      เพิ่มข้อคำถาม
                    </button>
                  </div>

                  <div className="space-y-4 max-h-60 overflow-y-auto pr-1">
                    {questions.map((q, qIdx) => (
                      <div key={qIdx} className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-300">ข้อที่ {qIdx + 1}</span>
                          {questions.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveQuestion(qIdx)}
                              className="text-rose-400 hover:text-rose-300 p-1 cursor-pointer"
                              title="ลบคำถามข้อนี้"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        <input
                          type="text"
                          required
                          value={q.question}
                          onChange={(e) => handleQuestionChange(qIdx, 'question', e.target.value)}
                          placeholder={`คำถามข้อที่ ${qIdx + 1}...`}
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-amber-500"
                        />

                        {/* Options */}
                        <div className="space-y-1.5 pl-1">
                          <span className="text-[10px] text-slate-400">ตัวเลือก (เลือกข้อที่ถูกต้องทางขวา):</span>
                          {q.options.map((opt, optIdx) => (
                            <div key={optIdx} className="flex items-center gap-2">
                              <input
                                type="radio"
                                name={`correct-${qIdx}`}
                                checked={q.correct_index === optIdx}
                                onChange={() => handleQuestionChange(qIdx, 'correct_index', optIdx)}
                                className="accent-amber-500 cursor-pointer"
                                title="ตั้งเป็นคำตอบที่ถูกต้อง"
                              />
                              <input
                                type="text"
                                value={opt}
                                onChange={(e) => handleOptionChange(qIdx, optIdx, e.target.value)}
                                placeholder={`ตัวเลือก ${optIdx + 1}`}
                                className="flex-1 px-2.5 py-1 bg-slate-900 border border-slate-700 rounded-md text-white text-xs focus:outline-none focus:border-amber-500"
                              />
                            </div>
                          ))}
                        </div>

                        {/* Explanation */}
                        <input
                          type="text"
                          value={q.explanation}
                          onChange={(e) => handleQuestionChange(qIdx, 'explanation', e.target.value)}
                          placeholder="คำอธิบายเฉลยเพิ่มเติม (ไม่บังคับ)"
                          className="w-full px-2.5 py-1 bg-slate-900/60 border border-slate-800 rounded-md text-slate-300 text-[11px] focus:outline-none"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black shadow-lg shadow-amber-950/40 transition-all cursor-pointer"
                >
                  บันทึกกิจกรรม
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
