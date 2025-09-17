import React, { useState } from 'react';
import { Search, User, FileText, TrendingUp, Calendar, MessageCircle, Award, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

const ReddIQ = () => {
  const [activeTab, setActiveTab] = useState('profile');
  const [profileData, setProfileData] = useState(null);
  const [postAnalysis, setPostAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch real Reddit profile data
  const fetchRedditProfile = async (username) => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch user data from Reddit's JSON API
      const userResponse = await fetch(`https://www.reddit.com/user/${username}/about.json`);
      if (!userResponse.ok) {
        throw new Error('User not found');
      }
      
      const userData = await userResponse.json();
      const user = userData.data;
      
      // Fetch recent posts for analysis
      const postsResponse = await fetch(`https://www.reddit.com/user/${username}/submitted.json?limit=25`);
      const postsData = await postsResponse.json();
      const posts = postsData.data?.children || [];
      
      // Fetch recent comments
      const commentsResponse = await fetch(`https://www.reddit.com/user/${username}/comments.json?limit=25`);
      const commentsData = await commentsResponse.json();
      const comments = commentsData.data?.children || [];
      
      // Calculate metrics
      const accountAge = Math.floor((Date.now() / 1000 - user.created_utc) / (24 * 60 * 60));
      const avgPostScore = posts.length > 0 ? posts.reduce((sum, post) => sum + post.data.score, 0) / posts.length : 0;
      const avgCommentScore = comments.length > 0 ? comments.reduce((sum, comment) => sum + comment.data.score, 0) / comments.length : 0;
      
      // Get subreddit activity
      const subredditActivity = {};
      posts.forEach(post => {
        const sub = post.data.subreddit;
        subredditActivity[sub] = (subredditActivity[sub] || 0) + 1;
      });
      
      const topSubreddits = Object.entries(subredditActivity)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([sub]) => sub);
      
      const processedData = {
        username: user.name,
        totalKarma: user.total_karma || (user.link_karma + user.comment_karma),
        postKarma: user.link_karma,
        commentKarma: user.comment_karma,
        accountAge,
        verified: user.verified,
        premium: user.is_gold,
        postsCount: posts.length,
        commentsCount: comments.length,
        avgPostScore: Math.round(avgPostScore * 10) / 10,
        avgCommentScore: Math.round(avgCommentScore * 10) / 10,
        topSubreddits,
        created: new Date(user.created_utc * 1000).toLocaleDateString(),
        recentPosts: posts.slice(0, 5).map(p => ({
          title: p.data.title,
          score: p.data.score,
          subreddit: p.data.subreddit,
          created: new Date(p.data.created_utc * 1000).toLocaleDateString()
        }))
      };
      
      const authorityScore = calculateAuthorityScore(processedData);
      setProfileData({ ...processedData, authorityScore });
      
    } catch (err) {
      setError(err.message === 'User not found' ? 'Reddit user not found. Please check the username.' : 'Failed to fetch profile data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Calculate authority score based on real metrics
  const calculateAuthorityScore = (data) => {
    let score = 0;
    
    // Account age (30 points max)
    if (data.accountAge > 1825) score += 30; // 5+ years
    else if (data.accountAge > 1095) score += 25; // 3+ years
    else if (data.accountAge > 365) score += 20; // 1+ year
    else if (data.accountAge > 180) score += 15; // 6+ months
    else if (data.accountAge > 30) score += 10; // 1+ month
    else score += 5;
    
    // Total karma (25 points max)
    if (data.totalKarma > 100000) score += 25;
    else if (data.totalKarma > 50000) score += 22;
    else if (data.totalKarma > 10000) score += 18;
    else if (data.totalKarma > 5000) score += 15;
    else if (data.totalKarma > 1000) score += 12;
    else if (data.totalKarma > 500) score += 8;
    else if (data.totalKarma > 100) score += 5;
    else score += 2;
    
    // Activity level (20 points max)
    const totalActivity = data.postsCount + data.commentsCount;
    if (totalActivity > 1000) score += 20;
    else if (totalActivity > 500) score += 16;
    else if (totalActivity > 100) score += 12;
    else if (totalActivity > 50) score += 8;
    else if (totalActivity > 10) score += 5;
    else score += 2;
    
    // Quality metrics (20 points max)
    if (data.avgPostScore > 100) score += 12;
    else if (data.avgPostScore > 50) score += 10;
    else if (data.avgPostScore > 20) score += 8;
    else if (data.avgPostScore > 10) score += 6;
    else if (data.avgPostScore > 5) score += 4;
    else score += 2;
    
    if (data.avgCommentScore > 10) score += 8;
    else if (data.avgCommentScore > 5) score += 6;
    else if (data.avgCommentScore > 2) score += 4;
    else if (data.avgCommentScore > 1) score += 2;
    
    // Verification bonus (5 points max)
    if (data.verified) score += 3;
    if (data.premium) score += 2;
    
    return Math.min(Math.round(score), 100);
  };

  // Analyze post for removal risk
  const analyzePost = async (content, subreddit) => {
    setLoading(true);
    setError(null);
    
    try {
      // Fetch subreddit info for rules analysis
      const subResponse = await fetch(`https://www.reddit.com/r/${subreddit}/about.json`);
      if (!subResponse.ok) {
        throw new Error('Subreddit not found');
      }
      
      const subData = await subResponse.json();
      const subInfo = subData.data;
      
      // Analyze content
      const issues = [];
      const warnings = [];
      
      // Basic content analysis
      if (content.trim().length === 0) {
        issues.push('Post content cannot be empty');
      }
      
      if (content.length < 10) {
        warnings.push('Very short posts often get low engagement');
      }
      
      if (content.length > 40000) {
        issues.push('Post exceeds Reddit character limit');
      }
      
      // Common Reddit violations
      if (content.toLowerCase().includes('upvote')) {
        issues.push('Asking for upvotes violates Reddit rules');
      }
      
      if (content.toLowerCase().includes('gold') && content.toLowerCase().includes('award')) {
        warnings.push('Asking for awards may be removed');
      }
      
      // Check for self-promotion patterns
      const urlPattern = /(https?:\/\/[^\s]+)/g;
      const urls = content.match(urlPattern) || [];
      if (urls.length > 2) {
        warnings.push('Multiple links may be flagged as spam');
      }
      
      // Content quality checks
      const capsRatio = (content.match(/[A-Z]/g) || []).length / content.length;
      if (capsRatio > 0.5 && content.length > 20) {
        warnings.push('Excessive caps may appear as spam');
      }
      
      const exclamationCount = (content.match(/!/g) || []).length;
      if (exclamationCount > 5) {
        warnings.push('Too many exclamation marks may reduce credibility');
      }
      
      // Subreddit-specific analysis
      const subName = subInfo.display_name.toLowerCase();
      if (subName === 'askreddit' && !content.includes('?')) {
        issues.push('AskReddit posts must contain a question');
      }
      
      if (subInfo.over18 && !content.includes('NSFW')) {
        warnings.push('NSFW subreddit may require NSFW tag');
      }
      
      // Calculate removal risk
      let riskScore = 0;
      riskScore += issues.length * 30;
      riskScore += warnings.length * 10;
      
      const riskLevel = riskScore > 50 ? 'high' : riskScore > 20 ? 'medium' : 'low';
      
      setPostAnalysis({
        subreddit: subInfo.display_name,
        subscribers: subInfo.subscribers,
        issues,
        warnings,
        riskLevel,
        riskScore: Math.min(riskScore, 100)
      });
      
    } catch (err) {
      setError(err.message === 'Subreddit not found' ? 'Subreddit not found. Please check the name.' : 'Failed to analyze post. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-blue-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBg = (score) => {
    if (score >= 80) return 'bg-green-100';
    if (score >= 60) return 'bg-blue-100';
    if (score >= 40) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  const getRiskColor = (level) => {
    switch(level) {
      case 'low': return 'text-green-600 bg-green-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'high': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <div className="bg-black/20 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-red-500 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">ReddIQ</h1>
              <p className="text-gray-300">Professional Reddit Analysis Tool</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Navigation Tabs */}
        <div className="flex gap-4 mb-8">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
              activeTab === 'profile'
                ? 'bg-white text-gray-900 shadow-lg'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            <User className="w-5 h-5" />
            Profile Analysis
          </button>
          <button
            onClick={() => setActiveTab('post')}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
              activeTab === 'post'
                ? 'bg-white text-gray-900 shadow-lg'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            <FileText className="w-5 h-5" />
            Post Analysis
          </button>
        </div>

        {/* Profile Analysis Tab */}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <h2 className="text-xl font-bold text-white mb-4">Reddit Profile Authority Score</h2>
              <div className="flex gap-4">
                <input
                  type="text"
                  placeholder="Enter Reddit username (without u/)"
                  className="flex-1 px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      const username = e.target.value.trim();
                      if (username) fetchRedditProfile(username);
                    }
                  }}
                />
                <button
                  onClick={() => {
                    const input = document.querySelector('input[placeholder*="username"]');
                    const username = input.value.trim();
                    if (username) fetchRedditProfile(username);
                  }}
                  disabled={loading}
                  className="px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg font-medium hover:shadow-lg transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Search className="w-5 h-5" />
                  )}
                  Analyze
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-red-300">
                  <XCircle className="w-5 h-5" />
                  {error}
                </div>
              </div>
            )}

            {profileData && (
              <div className="grid md:grid-cols-2 gap-6">
                {/* Score Display */}
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
                  <div className="text-center">
                    <div className={`w-32 h-32 mx-auto rounded-full flex items-center justify-center text-4xl font-bold mb-4 ${getScoreBg(profileData.authorityScore)}`}>
                      <span className={getScoreColor(profileData.authorityScore)}>
                        {profileData.authorityScore}
                      </span>
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2">{profileData.username}</h3>
                    <p className="text-gray-300">Authority Score</p>
                  </div>
                </div>

                {/* Key Metrics */}
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
                  <h3 className="text-lg font-bold text-white mb-4">Key Metrics</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-300 flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Account Age
                      </span>
                      <span className="text-white font-medium">{profileData.accountAge} days</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-300 flex items-center gap-2">
                        <Award className="w-4 h-4" />
                        Total Karma
                      </span>
                      <span className="text-white font-medium">{profileData.totalKarma.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-300 flex items-center gap-2">
                        <MessageCircle className="w-4 h-4" />
                        Avg Post Score
                      </span>
                      <span className="text-white font-medium">{profileData.avgPostScore}</span>
                    </div>
                  </div>
                </div>

                {/* Detailed Analysis */}
                <div className="md:col-span-2 bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
                  <h3 className="text-lg font-bold text-white mb-4">Detailed Analysis</h3>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-white font-medium mb-2">Recent Activity</h4>
                      <div className="space-y-2 text-sm text-gray-300">
                        <p>Posts: {profileData.postsCount}</p>
                        <p>Comments: {profileData.commentsCount}</p>
                        <p>Post Karma: {profileData.postKarma.toLocaleString()}</p>
                        <p>Comment Karma: {profileData.commentKarma.toLocaleString()}</p>
                      </div>
                    </div>
                    <div>
                      <h4 className="text-white font-medium mb-2">Top Subreddits</h4>
                      <div className="space-y-1 text-sm text-gray-300">
                        {profileData.topSubreddits.map((sub, index) => (
                          <p key={index}>r/{sub}</p>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Post Analysis Tab */}
        {activeTab === 'post' && (
          <div className="space-y-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <h2 className="text-xl font-bold text-white mb-4">Post Removal Risk Analysis</h2>
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Enter subreddit name (without r/)"
                  className="w-full px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
                <textarea
                  placeholder="Paste your post title and content here..."
                  rows={6}
                  className="w-full px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                />
                <button
                  onClick={() => {
                    const subreddit = document.querySelector('input[placeholder*="subreddit"]').value.trim();
                    const content = document.querySelector('textarea').value.trim();
                    if (subreddit && content) analyzePost(content, subreddit);
                  }}
                  disabled={loading}
                  className="w-full px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg font-medium hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Search className="w-5 h-5" />
                  )}
                  Analyze Post
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-red-300">
                  <XCircle className="w-5 h-5" />
                  {error}
                </div>
              </div>
            )}

            {postAnalysis && (
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-white">Analysis Results</h3>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getRiskColor(postAnalysis.riskLevel)}`}>
                    {postAnalysis.riskLevel.toUpperCase()} RISK
                  </span>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-white font-medium mb-2">Subreddit Info</h4>
                    <div className="text-sm text-gray-300">
                      <p>r/{postAnalysis.subreddit}</p>
                      <p>{postAnalysis.subscribers?.toLocaleString()} subscribers</p>
                    </div>
                  </div>

                  {postAnalysis.issues.length > 0 && (
                    <div>
                      <h4 className="text-red-400 font-medium mb-2 flex items-center gap-2">
                        <XCircle className="w-4 h-4" />
                        Critical Issues
                      </h4>
                      <ul className="text-sm text-red-300 space-y-1">
                        {postAnalysis.issues.map((issue, index) => (
                          <li key={index}>• {issue}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {postAnalysis.warnings.length > 0 && (
                    <div>
                      <h4 className="text-yellow-400 font-medium mb-2 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        Warnings
                      </h4>
                      <ul className="text-sm text-yellow-300 space-y-1">
                        {postAnalysis.warnings.map((warning, index) => (
                          <li key={index}>• {warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {postAnalysis.issues.length === 0 && postAnalysis.warnings.length === 0 && (
                    <div>
                      <h4 className="text-green-400 font-medium mb-2 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" />
                        All Good!
                      </h4>
                      <p className="text-sm text-green-300">Your post looks ready to submit.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReddIQ;