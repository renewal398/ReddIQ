import React, { useState } from 'react';
import { Search, User, FileText, TrendingUp, Calendar, MessageCircle, Award, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

const ReddIQ = () => {
  const [activeTab, setActiveTab] = useState('profile');
  const [profileData, setProfileData] = useState(null);
  const [postAnalysis, setPostAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch Reddit profile data with CORS proxy
  const fetchRedditProfile = async (username) => {
    try {
      setLoading(true);
      setError(null);
      
      // Validate username format
      if (!/^[a-zA-Z0-9_-]{3,20}$/.test(username)) {
        throw new Error('Invalid username format');
      }
      
      const corsProxy = 'https://corsproxy.io/?';
      
      // Fetch user data with error handling
      const userResponse = await fetch(`${corsProxy}https://www.reddit.com/user/${username}/about.json`, {
        headers: { 'User-Agent': 'ReddIQ/1.0' }
      });
      
      if (!userResponse.ok) {
        if (userResponse.status === 404) {
          throw new Error('User not found');
        } else if (userResponse.status === 403) {
          throw new Error('User profile is private or suspended');
        } else {
          throw new Error('Failed to fetch user data');
        }
      }
      
      const userData = await userResponse.json();
      const user = userData.data;
      
      if (!user || user.is_suspended) {
        throw new Error('User account is suspended or deleted');
      }
      
      // Fetch posts and comments with fallback
      let posts = [];
      let comments = [];
      
      try {
        const postsResponse = await fetch(`${corsProxy}https://www.reddit.com/user/${username}/submitted.json?limit=100`, {
          headers: { 'User-Agent': 'ReddIQ/1.0' }
        });
        if (postsResponse.ok) {
          const postsData = await postsResponse.json();
          posts = postsData.data?.children || [];
        }
      } catch (e) {
        console.warn('Could not fetch posts:', e);
      }
      
      try {
        const commentsResponse = await fetch(`${corsProxy}https://www.reddit.com/user/${username}/comments.json?limit=100`, {
          headers: { 'User-Agent': 'ReddIQ/1.0' }
        });
        if (commentsResponse.ok) {
          const commentsData = await commentsResponse.json();
          comments = commentsData.data?.children || [];
        }
      } catch (e) {
        console.warn('Could not fetch comments:', e);
      }
      
      // Calculate metrics
      const accountAge = Math.floor((Date.now() / 1000 - user.created_utc) / (24 * 60 * 60));
      const totalKarma = user.total_karma || (user.link_karma + user.comment_karma) || 0;
      
      const postScores = posts.map(p => p.data.score).filter(s => s >= 0);
      const commentScores = comments.map(c => c.data.score).filter(s => s >= 0);
      
      const avgPostScore = postScores.length > 0 ? postScores.reduce((a, b) => a + b, 0) / postScores.length : 0;
      const avgCommentScore = commentScores.length > 0 ? commentScores.reduce((a, b) => a + b, 0) / commentScores.length : 0;
      
      const highQualityPosts = posts.filter(p => p.data.score > 100).length;
      const controversialPosts = posts.filter(p => p.data.score < 0).length;
      
      // Analyze subreddit activity
      const subredditActivity = {};
      posts.forEach(post => {
        const sub = post.data.subreddit;
        subredditActivity[sub] = (subredditActivity[sub] || 0) + 1;
      });
      
      const topSubreddits = Object.entries(subredditActivity)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 8)
        .map(([name, activity]) => ({ name, activity }));
      
      const totalActivity = posts.length + comments.length;
      const engagementRatio = totalActivity > 0 ? (postScores.reduce((a, b) => a + b, 0) + commentScores.reduce((a, b) => a + b, 0)) / totalActivity : 0;
      
      const processedData = {
        username: user.name,
        totalKarma,
        postKarma: user.link_karma || 0,
        commentKarma: user.comment_karma || 0,
        accountAge,
        verified: user.verified || false,
        premium: user.is_gold || user.is_premium || false,
        employee: user.is_employee || false,
        mod: user.is_mod || false,
        postsCount: posts.length,
        commentsCount: comments.length,
        avgPostScore: Math.round(avgPostScore * 10) / 10,
        avgCommentScore: Math.round(avgCommentScore * 10) / 10,
        highQualityPosts,
        controversialPosts,
        engagementRatio: Math.round(engagementRatio * 10) / 10,
        topSubreddits,
        created: new Date(user.created_utc * 1000).toLocaleDateString(),
        totalActivity,
        recentPosts: posts.slice(0, 5).map(p => ({
          title: p.data.title || 'Untitled',
          score: p.data.score || 0,
          subreddit: p.data.subreddit || 'unknown',
          created: new Date(p.data.created_utc * 1000).toLocaleDateString()
        }))
      };
      
      const authorityScore = calculateAuthorityScore(processedData);
      setProfileData({ ...processedData, authorityScore });
      
    } catch (err) {
      console.error('Profile fetch error:', err);
      const errorMessage = err.message.includes('User not found') ? 'Reddit user not found. Please check the username spelling.' :
                          err.message.includes('private or suspended') ? 'User profile is private or suspended.' :
                          err.message.includes('Invalid username') ? 'Invalid username format. Use only letters, numbers, underscores, and hyphens (3-20 characters).' :
                          'Failed to fetch profile data. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Calculate authority score
  const calculateAuthorityScore = (data) => {
    let score = 0;
    
    // Account age (25 points max)
    if (data.accountAge > 2555) score += 25;
    else if (data.accountAge > 1825) score += 22;
    else if (data.accountAge > 1095) score += 20;
    else if (data.accountAge > 730) score += 17;
    else if (data.accountAge > 365) score += 15;
    else if (data.accountAge > 180) score += 10;
    else if (data.accountAge > 90) score += 7;
    else if (data.accountAge > 30) score += 5;
    else score += 2;
    
    // Karma score (20 points max)
    if (data.totalKarma > 1000000) score += 20;
    else if (data.totalKarma > 100000) score += 18;
    else if (data.totalKarma > 50000) score += 17;
    else if (data.totalKarma > 25000) score += 16;
    else if (data.totalKarma > 10000) score += 15;
    else if (data.totalKarma > 5000) score += 14;
    else if (data.totalKarma > 2500) score += 12;
    else if (data.totalKarma > 1000) score += 10;
    else if (data.totalKarma > 500) score += 8;
    else if (data.totalKarma > 100) score += 6;
    else if (data.totalKarma > 50) score += 4;
    else score += 2;
    
    // Activity level (15 points max)
    if (data.totalActivity > 5000) score += 15;
    else if (data.totalActivity > 2500) score += 13;
    else if (data.totalActivity > 1000) score += 12;
    else if (data.totalActivity > 500) score += 10;
    else if (data.totalActivity > 250) score += 9;
    else if (data.totalActivity > 100) score += 7;
    else if (data.totalActivity > 50) score += 6;
    else if (data.totalActivity > 25) score += 4;
    else if (data.totalActivity > 10) score += 3;
    else score += 1;
    
    // Quality metrics (20 points max)
    const postQuality = Math.min(data.avgPostScore / 50, 1) * 8;
    const commentQuality = Math.min(data.avgCommentScore / 10, 1) * 6;
    const engagementQuality = Math.min(data.engagementRatio / 20, 1) * 4;
    const highQualityRatio = data.postsCount > 0 ? Math.min(data.highQualityPosts / data.postsCount, 1) * 2 : 0;
    
    score += postQuality + commentQuality + engagementQuality + highQualityRatio;
    
    // Verification bonuses (5 points max)
    if (data.verified) score += 2;
    if (data.premium) score += 1.5;
    if (data.employee) score += 1;
    if (data.mod) score += 0.5;
    
    // Subreddit diversity (5 points max)
    const diversityScore = Math.min(data.topSubreddits.length / 8, 1) * 5;
    score += diversityScore;
    
    // Penalties
    if (data.controversialPosts > data.postsCount * 0.2) {
      score -= 5;
    }
    
    return Math.max(0, Math.min(Math.round(score), 100));
  };

  // Analyze post for removal risk
  const analyzePost = async (content, subreddit) => {
    setLoading(true);
    setError(null);
    
    try {
      const corsProxy = 'https://corsproxy.io/?';
      
      // Fetch subreddit info
      const subResponse = await fetch(`${corsProxy}https://www.reddit.com/r/${subreddit}/about.json`, {
        headers: { 'User-Agent': 'ReddIQ/1.0' }
      });
      
      if (!subResponse.ok) {
        throw new Error('Subreddit not found');
      }
      
      const subData = await subResponse.json();
      const subInfo = subData.data;
      
      // Fetch rules (optional)
      let rules = [];
      try {
        const rulesResponse = await fetch(`${corsProxy}https://www.reddit.com/r/${subreddit}/about/rules.json`, {
          headers: { 'User-Agent': 'ReddIQ/1.0' }
        });
        if (rulesResponse.ok) {
          const rulesData = await rulesResponse.json();
          rules = rulesData.rules || [];
        }
      } catch (e) {
        console.warn('Could not fetch rules:', e);
      }
      
      const issues = [];
      const warnings = [];
      const suggestions = [];
      
      // Basic validation
      if (content.trim().length === 0) {
        issues.push('Post content cannot be empty');
      }
      
      const title = content.split('\n')[0] || content.substring(0, 300);
      const body = content.includes('\n') ? content.substring(content.indexOf('\n') + 1) : '';
      
      if (title.length < 3) {
        issues.push('Title too short (minimum 3 characters)');
      }
      
      if (title.length > 300) {
        issues.push('Title exceeds Reddit limit (300 characters)');
      }
      
      if (content.length > 40000) {
        issues.push('Post exceeds Reddit character limit (40,000)');
      }
      
      // Common Reddit violations
      const lowerContent = content.toLowerCase();
      
      if (lowerContent.includes('upvote') || lowerContent.includes('downvote')) {
        issues.push('Vote manipulation detected - violates Reddit Content Policy');
      }
      
      if (lowerContent.includes('gold') || lowerContent.includes('award')) {
        warnings.push('Requesting awards may be removed by moderators');
      }
      
      // URL analysis
      const urlPattern = /(https?:\/\/[^\s]+)/gi;
      const urls = content.match(urlPattern) || [];
      
      if (urls.length > 3) {
        warnings.push('Multiple links may trigger spam filters');
      }
      
      // Content quality checks
      const capsRatio = (content.match(/[A-Z]/g) || []).length / content.length;
      if (capsRatio > 0.3 && content.length > 50) {
        warnings.push('Excessive capitalization may appear unprofessional');
      }
      
      const exclamationCount = (content.match(/!/g) || []).length;
      if (exclamationCount > 3) {
        warnings.push('Too many exclamation marks may reduce credibility');
      }
      
      // Subreddit-specific rules
      const subName = subInfo.display_name.toLowerCase();
      
      if (subName === 'askreddit') {
        if (!content.includes('?')) {
          issues.push('AskReddit requires posts to be questions');
        }
        if (body.trim().length > 0) {
          issues.push('AskReddit posts must be title-only (no text in body)');
        }
      }
      
      if (subName === 'todayilearned' || subName === 'til') {
        if (!lowerContent.startsWith('til')) {
          issues.push('TIL posts must start with "TIL"');
        }
        if (urls.length === 0) {
          issues.push('TIL posts require a source link');
        }
      }
      
      if (subName === 'showerthoughts') {
        if (content.includes('?')) {
          issues.push('Shower Thoughts cannot be questions');
        }
      }
      
      // Generate suggestions
      if (issues.length === 0 && warnings.length === 0) {
        suggestions.push('Post looks good for submission!');
        suggestions.push('Consider posting during peak hours for better visibility');
      } else {
        suggestions.push('Fix all critical issues before posting');
        suggestions.push('Review subreddit rules carefully');
      }
      
      // Calculate risk score
      let riskScore = 0;
      riskScore += issues.length * 35;
      riskScore += warnings.length * 15;
      
      const riskLevel = riskScore > 60 ? 'high' : riskScore > 25 ? 'medium' : 'low';
      
      setPostAnalysis({
        subreddit: subInfo.display_name,
        subscribers: subInfo.subscribers,
        isNSFW: subInfo.over18,
        rules,
        issues,
        warnings,
        suggestions,
        riskLevel,
        riskScore: Math.min(riskScore, 100),
        title: title.substring(0, 100) + (title.length > 100 ? '...' : ''),
        hasBody: body.length > 0,
        linkCount: urls.length
      });
      
    } catch (err) {
      console.error('Analysis error:', err);
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

  const handleProfileSubmit = () => {
    const input = document.querySelector('input[placeholder*="username"]');
    if (input) {
      const username = input.value.trim();
      if (username) fetchRedditProfile(username);
    }
  };

  const handlePostSubmit = () => {
    const subredditInput = document.querySelector('input[placeholder*="subreddit"]');
    const contentInput = document.querySelector('textarea');
    if (subredditInput && contentInput) {
      const subreddit = subredditInput.value.trim();
      const content = contentInput.value.trim();
      if (subreddit && content) analyzePost(content, subreddit);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black">
      {/* Shining effect overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-pulse"></div>
      
      {/* Header */}
      <div className="relative bg-black/30 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <div className="flex items-center justify-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-red-500 rounded-lg flex items-center justify-center shadow-lg shadow-orange-500/25">
              <TrendingUp className="w-7 h-7 text-white" />
            </div>
            <div className="text-center">
              <h1 className="text-3xl font-bold text-white">ReddIQ</h1>
              <p className="text-gray-300">Professional Reddit Analysis Tool</p>
            </div>
          </div>
        </div>
      </div>

      <div className="relative max-w-4xl mx-auto px-6 py-8">
        {/* Navigation Tabs */}
        <div className="flex justify-center gap-4 mb-8">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
              activeTab === 'profile'
                ? 'bg-white text-gray-900 shadow-lg shadow-white/20'
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
                ? 'bg-white text-gray-900 shadow-lg shadow-white/20'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            <FileText className="w-5 h-5" />
            Post Analysis
          </button>
        </div>

        {/* Profile Analysis Tab */}
        {activeTab === 'profile' && (
          <div className="space-y-6 max-w-2xl mx-auto">
            <div className="bg-black/40 backdrop-blur-sm rounded-xl p-6 border border-white/20 shadow-2xl">
              <h2 className="text-xl font-bold text-white mb-4 text-center">Reddit Profile Authority Score</h2>
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Enter Reddit username (without u/)"
                  className="w-full px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleProfileSubmit();
                    }
                  }}
                />
                <button
                  onClick={handleProfileSubmit}
                  disabled={loading}
                  className="w-full px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg font-medium hover:shadow-lg hover:shadow-orange-500/25 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Search className="w-5 h-5" />
                  )}
                  Analyze Profile
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 max-w-2xl mx-auto">
                <div className="flex items-center gap-2 text-red-300">
                  <XCircle className="w-5 h-5" />
                  {error}
                </div>
              </div>
            )}

            {profileData && (
              <div className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-black/40 backdrop-blur-sm rounded-xl p-6 border border-white/20 shadow-2xl">
                    <div className="text-center">
                      <div className={`w-32 h-32 mx-auto rounded-full flex items-center justify-center text-4xl font-bold mb-4 ${getScoreBg(profileData.authorityScore)} shadow-lg`}>
                        <span className={getScoreColor(profileData.authorityScore)}>
                          {profileData.authorityScore}
                        </span>
                      </div>
                      <h3 className="text-2xl font-bold text-white mb-2">u/{profileData.username}</h3>
                      <p className="text-gray-300">Authority Score</p>
                      <div className="flex justify-center gap-2 mt-2 flex-wrap">
                        {profileData.verified && <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-xs">Verified</span>}
                        {profileData.premium && <span className="px-2 py-1 bg-yellow-500/20 text-yellow-300 rounded text-xs">Premium</span>}
                        {profileData.employee && <span className="px-2 py-1 bg-red-500/20 text-red-300 rounded text-xs">Admin</span>}
                        {profileData.mod && <span className="px-2 py-1 bg-green-500/20 text-green-300 rounded text-xs">Moderator</span>}
                      </div>
                    </div>
                  </div>

                  <div className="bg-black/40 backdrop-blur-sm rounded-xl p-6 border border-white/20 shadow-2xl">
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
                          <TrendingUp className="w-4 h-4" />
                          Engagement Ratio
                        </span>
                        <span className="text-white font-medium">{profileData.engagementRatio}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-300 flex items-center gap-2">
                          <MessageCircle className="w-4 h-4" />
                          Quality Posts
                        </span>
                        <span className="text-white font-medium">{profileData.highQualityPosts}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {profileData.recentPosts.length > 0 && (
                  <div className="bg-black/40 backdrop-blur-sm rounded-xl p-6 border border-white/20 shadow-2xl">
                    <h3 className="text-lg font-bold text-white mb-4">Recent Posts</h3>
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {profileData.recentPosts.map((post, index) => (
                        <div key={index} className="bg-white/5 rounded-lg p-3">
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="text-white text-sm font-medium line-clamp-2">{post.title}</h4>
                            <span className="text-gray-400 text-xs ml-2 flex-shrink-0">{post.score}↑</span>
                          </div>
                          <div className="flex justify-between text-xs text-gray-400">
                            <span>r/{post.subreddit}</span>
                            <span>{post.created}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Post Analysis Tab */}
        {activeTab === 'post' && (
          <div className="space-y-6 max-w-2xl mx-auto">
            <div className="bg-black/40 backdrop-blur-sm rounded-xl p-6 border border-white/20 shadow-2xl">
              <h2 className="text-xl font-bold text-white mb-4 text-center">Post Removal Risk Analysis</h2>
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
                  onClick={handlePostSubmit}
                  disabled={loading}
                  className="w-full px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg font-medium hover:shadow-lg hover:shadow-orange-500/25 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
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
              <div className="bg-black/40 backdrop-blur-sm rounded-xl p-6 border border-white/20 shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-white">Analysis Results</h3>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getRiskColor(postAnalysis.riskLevel)}`}>
                    {postAnalysis.riskLevel.toUpperCase()} RISK
                  </span>
                </div>

                <div className="grid gap-6 mb-6">
                  <div>
                    <h4 className="text-white font-medium mb-2">Subreddit: r/{postAnalysis.subreddit}</h4>
                    <p className="text-sm text-gray-300">{postAnalysis.subscribers?.toLocaleString()} subscribers</p>
                    {postAnalysis.isNSFW && <p className="text-red-400 text-sm">NSFW Community</p>}
                  </div>
                </div>

                <div className="space-y-4">
                  {postAnalysis.issues.length > 0 && (
                    <div>
                      <h4 className="text-red-400 font-medium mb-2 flex items-center gap-2">
                        <XCircle className="w-4 h-4" />
                        Critical Issues ({postAnalysis.issues.length})
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
                        Warnings ({postAnalysis.warnings.length})
                      </h4>
                      <ul className="text-sm text-yellow-300 space-y-1">
                        {postAnalysis.warnings.map((warning, index) => (
                          <li key={index}>• {warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {postAnalysis.suggestions.length > 0 && (
                    <div>
                      <h4 className="text-blue-400 font-medium mb-2 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" />
                        Suggestions
                      </h4>
                      <ul className="text-sm text-blue-300 space-y-1">
                        {postAnalysis.suggestions.map((suggestion, index) => (
                          <li key={index}>• {suggestion}</li>
                        ))}
                      </ul>
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
