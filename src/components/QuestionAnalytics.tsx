import React from 'react';
import { BarChart3, TrendingUp, Users, Clock, X, CheckCircle, XCircle } from 'lucide-react';
import { Question } from '../types/game';

interface QuestionAnalyticsProps {
  questions: Question[];
  teams: any[];
  onClose: () => void;
}

const QuestionAnalytics: React.FC<QuestionAnalyticsProps> = ({ questions, teams, onClose }) => {
  // Calculate analytics data
  const getQuestionStats = () => {
    return questions.map((question, index) => {
      const attempts = teams.filter(team => team.currentQuestion > index).length;
      const totalTeams = teams.length;
      const successRate = totalTeams > 0 ? (attempts / totalTeams) * 100 : 0;
      
      return {
        ...question,
        index: index + 1,
        attempts,
        successRate,
        difficulty: successRate > 80 ? 'Easy' : successRate > 50 ? 'Medium' : 'Hard'
      };
    });
  };

  const questionStats = getQuestionStats();
  const totalQuestions = questions.length;
  const averageSuccessRate = questionStats.reduce((sum, q) => sum + q.successRate, 0) / totalQuestions;
  
  const categoryStats = questions.reduce((acc, question, index) => {
    const category = question.category;
    if (!acc[category]) {
      acc[category] = { total: 0, attempts: 0 };
    }
    acc[category].total++;
    acc[category].attempts += teams.filter(team => team.currentQuestion > index).length;
    return acc;
  }, {} as Record<string, { total: number; attempts: number }>);

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Easy': return 'text-green-400 bg-green-500/20';
      case 'Medium': return 'text-yellow-400 bg-yellow-500/20';
      case 'Hard': return 'text-red-400 bg-red-500/20';
      default: return 'text-gray-400 bg-gray-500/20';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900/90 border border-blue-400/30 rounded-2xl p-6 max-w-7xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <BarChart3 className="w-6 h-6 text-blue-400" />
            <h3 className="text-2xl font-bold text-white">Question Analytics</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white transition-colors duration-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-gray-800/50 rounded-lg p-6 border border-blue-400/20">
            <div className="flex items-center space-x-3 mb-2">
              <BarChart3 className="w-5 h-5 text-blue-400" />
              <span className="text-gray-300 text-sm">Total Questions</span>
            </div>
            <div className="text-2xl font-bold text-white">{totalQuestions}</div>
          </div>

          <div className="bg-gray-800/50 rounded-lg p-6 border border-green-400/20">
            <div className="flex items-center space-x-3 mb-2">
              <TrendingUp className="w-5 h-5 text-green-400" />
              <span className="text-gray-300 text-sm">Avg Success Rate</span>
            </div>
            <div className="text-2xl font-bold text-green-400">{averageSuccessRate.toFixed(1)}%</div>
          </div>

          <div className="bg-gray-800/50 rounded-lg p-6 border border-purple-400/20">
            <div className="flex items-center space-x-3 mb-2">
              <Users className="w-5 h-5 text-purple-400" />
              <span className="text-gray-300 text-sm">Active Teams</span>
            </div>
            <div className="text-2xl font-bold text-purple-400">{teams.length}</div>
          </div>

          <div className="bg-gray-800/50 rounded-lg p-6 border border-orange-400/20">
            <div className="flex items-center space-x-3 mb-2">
              <Clock className="w-5 h-5 text-orange-400" />
              <span className="text-gray-300 text-sm">Categories</span>
            </div>
            <div className="text-2xl font-bold text-orange-400">{Object.keys(categoryStats).length}</div>
          </div>
        </div>

        {/* Category Performance */}
        <div className="mb-8">
          <h4 className="text-xl font-bold text-white mb-4">Category Performance</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(categoryStats).map(([category, stats]) => {
              const successRate = stats.total > 0 ? (stats.attempts / (stats.total * teams.length)) * 100 : 0;
              return (
                <div key={category} className="bg-gray-800/30 rounded-lg p-4 border border-gray-600/30">
                  <h5 className="text-white font-semibold mb-2">{category}</h5>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Questions:</span>
                      <span className="text-gray-300">{stats.total}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Success Rate:</span>
                      <span className={`font-semibold ${
                        successRate > 70 ? 'text-green-400' : 
                        successRate > 40 ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {successRate.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          successRate > 70 ? 'bg-green-500' : 
                          successRate > 40 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${Math.min(successRate, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Individual Question Performance */}
        <div>
          <h4 className="text-xl font-bold text-white mb-4">Individual Question Performance</h4>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-600">
                  <th className="text-left py-3 px-4 text-gray-300 font-semibold">#</th>
                  <th className="text-left py-3 px-4 text-gray-300 font-semibold">Question</th>
                  <th className="text-center py-3 px-4 text-gray-300 font-semibold">Category</th>
                  <th className="text-center py-3 px-4 text-gray-300 font-semibold">Points</th>
                  <th className="text-center py-3 px-4 text-gray-300 font-semibold">Attempts</th>
                  <th className="text-center py-3 px-4 text-gray-300 font-semibold">Success Rate</th>
                  <th className="text-center py-3 px-4 text-gray-300 font-semibold">Difficulty</th>
                </tr>
              </thead>
              <tbody>
                {questionStats.map((question) => (
                  <tr key={question.id} className="border-b border-gray-700/50 hover:bg-gray-800/30">
                    <td className="py-4 px-4">
                      <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                        {question.index}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="max-w-md">
                        <div className="text-white font-medium truncate">{question.title}</div>
                        <div className="text-gray-400 text-sm truncate">{question.question}</div>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className="bg-blue-500/20 text-blue-300 px-2 py-1 rounded text-sm">
                        {question.category}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className="text-green-400 font-semibold">{question.points}</span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <div className="flex items-center justify-center space-x-1">
                        <Users className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-300">{question.attempts}/{teams.length}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <div className="flex items-center justify-center space-x-2">
                        {question.successRate > 50 ? (
                          <CheckCircle className="w-4 h-4 text-green-400" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-400" />
                        )}
                        <span className={`font-semibold ${
                          question.successRate > 70 ? 'text-green-400' : 
                          question.successRate > 40 ? 'text-yellow-400' : 'text-red-400'
                        }`}>
                          {question.successRate.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className={`px-2 py-1 rounded text-sm font-medium ${getDifficultyColor(question.difficulty)}`}>
                        {question.difficulty}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Insights */}
        <div className="mt-8 bg-blue-900/30 border border-blue-500/30 rounded-lg p-6">
          <h4 className="text-blue-300 font-semibold mb-4">📊 Analytics Insights</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h5 className="text-blue-200 font-medium mb-2">Performance Summary:</h5>
              <ul className="text-blue-100 space-y-1">
                <li>• {questionStats.filter(q => q.difficulty === 'Easy').length} Easy questions ({((questionStats.filter(q => q.difficulty === 'Easy').length / totalQuestions) * 100).toFixed(1)}%)</li>
                <li>• {questionStats.filter(q => q.difficulty === 'Medium').length} Medium questions ({((questionStats.filter(q => q.difficulty === 'Medium').length / totalQuestions) * 100).toFixed(1)}%)</li>
                <li>• {questionStats.filter(q => q.difficulty === 'Hard').length} Hard questions ({((questionStats.filter(q => q.difficulty === 'Hard').length / totalQuestions) * 100).toFixed(1)}%)</li>
              </ul>
            </div>
            <div>
              <h5 className="text-blue-200 font-medium mb-2">Recommendations:</h5>
              <ul className="text-blue-100 space-y-1">
                {averageSuccessRate < 30 && <li>• Consider adding more hints or reducing difficulty</li>}
                {averageSuccessRate > 90 && <li>• Questions might be too easy, consider increasing difficulty</li>}
                <li>• Monitor questions with &lt;20% success rate for potential issues</li>
                <li>• Balance question distribution across categories</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuestionAnalytics;