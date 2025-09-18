import { Search, User, FileText, TrendingUp, Calendar, MessageCircle, Award, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

const ReddIQ = () => {
  const [activeTab, setActiveTab] = useState('profile');
  const [profileData, setProfileData] = useState(null);
  const [postAnalysis, setPostAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Enhanced profile analysis with better accuracy and CORS handling
  const fetchRedditProfile = async (username) => {
    try {
      setLoading(true);
      setError(null);
      
      // Validate username format
      if (!/^[a-zA-Z0-9_-]{3,20}$/.test(username)) {
        throw new Error('Invalid username format');
      }
      
      // Use CORS proxy for Reddit API calls
      const corsProxy = 'https://corsproxy.io/?';
      
      // Fetch comprehensive user data with CORS proxy
      const [userResponse, postsResponse, commentsResponse] = await Promise.all([
        fetch(`${corsProxy}https://www.reddit.com/user/${username}/about.json`, {
          headers: {
            'User-Agent': 'ReddIQ/1.0'
          }
        }),
        fetch(`${corsProxy}https://www.reddit.com/user/${username}/submitted.json?limit=100`, {
          headers: {
            'User-Agent': 'ReddIQ/1.0'
          }
        }),
        fetch(`${corsProxy}https://www.reddit.com/user/${username}/comments.json?limit=100`, {
          headers: {
            'User-Agent': 'ReddIQ/1.0'
          }
        })
      ]);
      
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
      
      // Handle suspended or banned users
      if (user.is_suspended) {
        throw new Error('User account is suspended');
      }
      
      const postsData = postsResponse.ok ? await postsResponse.json() : { data: { children: [] } };
      const commentsData = commentsResponse.ok ? await commentsResponse.json() : { data: { children: [] } };
      
      const posts = postsData.data?.children || [];
      const comments = commentsData.data?.children || [];
      
      // Enhanced metrics calculation
      const accountAge = Math.floor((Date.now() / 1000 - user.created_utc) / (24 * 60 * 60));
      const totalKarma = user.total_karma || (user.link_karma + user.comment_karma);
      
      // Analyze posting patterns
      const postScores = posts.map(p => p.data.score).filter(s => s >= 0);
      const commentScores = comments.map(c => c.data.score).filter(s => s >= 0);
      
      const avgPostScore = postScores.length > 0 ? postScores.reduce((a, b) => a + b, 0) / postScores.length : 0;
      const avgCommentScore = commentScores.length > 0 ? commentScores.reduce((a, b) => a + b, 0) / commentScores.length : 0;
      
      // Calculate engagement quality
      const highQualityPosts = posts.filter(p => p.data.score > 100).length;
      const controversialPosts = posts.filter(p => p.data.score < 0).length;
      
      // Analyze subreddit diversity
      const subredditActivity = {};
      const subredditKarma = {};
      
      posts.forEach(post => {
        const sub = post.data.subreddit;
        const score = post.data.score;
        subredditActivity[sub] = (subredditActivity[sub] || 0) + 1;
        subredditKarma[sub] = (subredditKarma[sub] || 0) + Math.max(0, score);
      });
      
      comments.forEach(comment => {
        const sub = comment.data.subreddit;
        subredditActivity[sub] = (subredditActivity[sub] || 0) + 1;
      });
      
      const topSubreddits = Object.entries(subredditActivity)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 8)
        .map(([sub, count]) => ({ name: sub, activity: count, karma: subredditKarma[sub] || 0 }));
      
      // Analyze posting consistency
      const postDates = posts.map(p => new Date(p.data.created_utc * 1000));
      const commentDates = comments.map(c => new Date(c.data.created_utc * 1000));
      const allDates = [...postDates, ...commentDates].sort((a, b) => b - a);
      
      let consistencyScore = 0;
      if (allDates.length > 10) {
        const daysBetween = allDates.map((date, i) => {
          if (i === allDates.length - 1) return 0;
          return Math.abs((allDates[i] - allDates[i + 1]) / (1000 * 60 * 60 * 24));
        });
        const avgDaysBetween = daysBetween.reduce((a, b) => a + b, 0) / daysBetween.length;
        consistencyScore = Math.max(0, 100 - avgDaysBetween * 2);
      }
      
      // Content quality analysis
      const totalUpvotes = [...postScores, ...commentScores].reduce((a, b) => a + b, 0);
      const totalContent = posts.length + comments.length;
      const engagementRatio = totalContent > 0 ? totalUpvotes / totalContent : 0;
      
      const processedData = {
        username: user.name,
        totalKarma,
        postKarma: user.link_karma || 0,
        commentKarma: user.comment_karma || 0,
        awardeeKarma: user.awardee_karma || 0,
        awarderKarma: user.awarder_karma || 0,
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
        consistencyScore: Math.round(consistencyScore),
        topSubreddits,
        created: new Date(user.created_utc * 1000).toLocaleDateString(),
        hasAvatar: user.icon_img && user.icon_img !== '',
        totalActivity: posts.length + comments.length,
        recentPosts: posts.slice(0, 5).map(p => ({
          title: p.data.title,
          score: p.data.score,
          subreddit: p.data.subreddit,
          created: new Date(p.data.created_utc * 1000).toLocaleDateString(),
          comments: p.data.num_comments
        }))
      };
      
      const authorityScore = calculateEnhancedAuthorityScore(processedData);
      setProfileData({ ...processedData, authorityScore });
      
    } catch (err) {
      console.error('Profile fetch error:', err);
      if (err.message.includes('User not found')) {
        setError('Reddit user not found. Please check the username spelling.');
      } else if (err.message.includes('private or suspended')) {
        setError('User profile is private or suspended.');
      } else if (err.message.includes('Invalid username')) {
        setError('Invalid username format. Use only letters, numbers, underscores, and hyphens (3-20 characters).');
      } else {
        setError('Failed to fetch profile data. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Enhanced authority scoring algorithm
  const calculateEnhancedAuthorityScore = (data) => {
    let score = 0;
    const weights = {
      accountAge: 25,
      karma: 20,
      activity: 15,
      quality: 20,
      consistency: 10,
      verification: 5,
      diversity: 5
    };
    
    // Account Age (25 points max)
    if (data.accountAge > 2555) score += weights.accountAge; // 7+ years
    else if (data.accountAge > 1825) score += weights.accountAge * 0.9; // 5+ years
    else if (data.accountAge > 1095) score += weights.accountAge * 0.8; // 3+ years
    else if (data.accountAge > 730) score += weights.accountAge * 0.7; // 2+ years
    else if (data.accountAge > 365) score += weights.accountAge * 0.6; // 1+ year
    else if (data.accountAge > 180) score += weights.accountAge * 0.4; // 6+ months
    else if (data.accountAge > 90) score += weights.accountAge * 0.3; // 3+ months
    else if (data.accountAge > 30) score += weights.accountAge * 0.2; // 1+ month
    else score += weights.accountAge * 0.1;
    
    // Karma Score (20 points max)
    if (data.totalKarma > 1000000) score += weights.karma;
    else if (data.totalKarma > 500000) score += weights.karma * 0.95;
    else if (data.totalKarma > 100000) score += weights.karma * 0.9;
    else if (data.totalKarma > 50000) score += weights.karma * 0.85;
    else if (data.totalKarma > 25000) score += weights.karma * 0.8;
    else if (data.totalKarma > 10000) score += weights.karma * 0.75;
    else if (data.totalKarma > 5000) score += weights.karma * 0.7;
    else if (data.totalKarma > 2500) score += weights.karma * 0.6;
    else if (data.totalKarma > 1000) score += weights.karma * 0.5;
    else if (data.totalKarma > 500) score += weights.karma * 0.4;
    else if (data.totalKarma > 100) score += weights.karma * 0.3;
    else if (data.totalKarma > 50) score += weights.karma * 0.2;
    else score += weights.karma * 0.1;
    
    // Activity Level (15 points max)
    if (data.totalActivity > 5000) score += weights.activity;
    else if (data.totalActivity > 2500) score += weights.activity * 0.9;
    else if (data.totalActivity > 1000) score += weights.activity * 0.8;
    else if (data.totalActivity > 500) score += weights.activity * 0.7;
    else if (data.totalActivity > 250) score += weights.activity * 0.6;
    else if (data.totalActivity > 100) score += weights.activity * 0.5;
    else if (data.totalActivity > 50) score += weights.activity * 0.4;
    else if (data.totalActivity > 25) score += weights.activity * 0.3;
    else if (data.totalActivity > 10) score += weights.activity * 0.2;
    else score += weights.activity * 0.1;
    
    // Quality Metrics (20 points max)
    const qualityScore = (
      Math.min(data.avgPostScore / 50, 1) * 0.4 +
      Math.min(data.avgCommentScore / 10, 1) * 0.3 +
      Math.min(data.engagementRatio / 20, 1) * 0.2 +
      Math.min(data.highQualityPosts / (data.postsCount || 1), 1) * 0.1
    );
    score += qualityScore * weights.quality;
    
    // Consistency (10 points max)
    score += (data.consistencyScore / 100) * weights.consistency;
    
    // Verification & Status (5 points max)
    if (data.verified) score += 2;
    if (data.premium) score += 1.5;
    if (data.employee) score += 1;
    if (data.mod) score += 0.5;
    
      // Subreddit Diversity (5 points max)
const diversityScore = Math.min(data.topSubreddits.length / 8, 1);
score += diversityScore * weights.diversity;

// Penalties
if (data.controversialPosts > data.postsCount * 0.2) {
  score -= 5; // High controversy penalty
}

// Karma scoring
if (data.totalKarma > 1000) score += 12;
else if (data.totalKarma > 500) score += 8;
else if (data.totalKarma > 100) score += 5;
else score += 2;

// Final normalized score (0–100)
return Math.max(0, Math.min(Math.round(score), 100));
};
    
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

  // Enhanced subreddit rule checking with CORS proxy
  const analyzePost = async (content, subreddit) => {
    setLoading(true);
    setError(null);
    
    try {
      // Use CORS proxy for Reddit API calls
      const corsProxy = 'https://corsproxy.io/?';
      
      // Fetch subreddit info and rules with CORS proxy
      const [subResponse, rulesResponse] = await Promise.all([
        fetch(`${corsProxy}https://www.reddit.com/r/${subreddit}/about.json`, {
          headers: {
            'User-Agent': 'ReddIQ/1.0'
          }
        }),
        fetch(`${corsProxy}https://www.reddit.com/r/${subreddit}/about/rules.json`, {
          headers: {
            'User-Agent': 'ReddIQ/1.0'
          }
        })
      ]);
      
      if (!subResponse.ok) {
        throw new Error('Subreddit not found');
      }
      
      const subData = await subResponse.json();
      const subInfo = subData.data;
      const rulesData = rulesResponse.ok ? await rulesResponse.json() : { rules: [] };
      
      const issues = [];
      const warnings = [];
      const suggestions = [];
      
      // Enhanced content analysis
      const title = content.split('\n')[0] || content.substring(0, 300);
      const body = content.includes('\n') ? content.substring(content.indexOf('\n') + 1) : '';
      
      // Basic validation
      if (content.trim().length === 0) {
        issues.push('Post content cannot be empty');
      }
      
      if (title.length < 3) {
        issues.push('Title too short (minimum 3 characters)');
      }
      
      if (title.length > 300) {
        issues.push('Title exceeds Reddit limit (300 characters)');
      }
      
      if (content.length > 40000) {
        issues.push('Post exceeds Reddit character limit (40,000)');
      }
      
      // Enhanced Reddit rule violations
      const lowerContent = content.toLowerCase();
      
      // Vote manipulation
      if (lowerContent.match(/upvote|downvote|karma.*please|vote.*up/)) {
        issues.push('Vote manipulation detected - violates Reddit Content Policy');
      }
      
      // Award begging
      if (lowerContent.match(/gold|silver|award.*please|give.*award/)) {
        warnings.push('Requesting awards may be removed by moderators');
      }
      
      // Self-promotion analysis
      const urlPattern = /(https?:\/\/[^\s]+)/gi;
      const urls = content.match(urlPattern) || [];
      const youtubeLinks = urls.filter(url => url.includes('youtube.com') || url.includes('youtu.be'));
      const socialLinks = urls.filter(url => 
        url.includes('instagram.com') || 
        url.includes('twitter.com') || 
        url.includes('tiktok.com') ||
        url.includes('facebook.com')
      );
      
      if (urls.length > 3) {
        warnings.push('Multiple links may trigger spam filters');
      }
      
      if (youtubeLinks.length > 0) {
        warnings.push('YouTube links often require established account history');
      }
      
      if (socialLinks.length > 0) {
        warnings.push('Social media links may be restricted in many subreddits');
      }
      
      // Content quality analysis
      const capsRatio = (content.match(/[A-Z]/g) || []).length / content.length;
      if (capsRatio > 0.3 && content.length > 50) {
        warnings.push('Excessive capitalization may appear unprofessional');
      }
      
      const exclamationCount = (content.match(/!/g) || []).length;
      if (exclamationCount > 3) {
        warnings.push('Too many exclamation marks may reduce credibility');
      }
      
      // Spam indicators
      const repeatedWords = content.match(/(\b\w+\b)(?:\s+\1\b)+/gi);
      if (repeatedWords && repeatedWords.length > 2) {
        warnings.push('Repeated words detected - may trigger spam filters');
      }
      
      // Enhanced subreddit-specific rules
      const subName = subInfo.display_name.toLowerCase();
      
      // Popular subreddit rules
      switch (subName) {
        case 'askreddit':
          if (!content.includes('?')) {
            issues.push('AskReddit requires posts to be questions');
          }
          if (lowerContent.includes('yes/no') || lowerContent.includes('yes or no')) {
            issues.push('Yes/no questions not allowed in AskReddit');
          }
          if (body.trim().length > 0) {
            issues.push('AskReddit posts must be title-only (no text in body)');
          }
          break;
          
        case 'explainlikeimfive':
        case 'eli5':
          if (!lowerContent.startsWith('eli5:')) {
            warnings.push('ELI5 posts should start with "ELI5:"');
          }
          if (!content.includes('?') && !lowerContent.includes('how') && !lowerContent.includes('why')) {
            warnings.push('ELI5 posts should ask for explanations');
          }
          break;
          
        case 'todayilearned':
        case 'til':
          if (!lowerContent.startsWith('til')) {
            issues.push('TIL posts must start with "TIL"');
          }
          if (urls.length === 0) {
            issues.push('TIL posts require a source link');
          }
          break;
          
        case 'showerthoughts':
          if (content.includes('?')) {
            issues.push('Shower Thoughts cannot be questions');
          }
          if (lowerContent.includes('dae') || lowerContent.includes('does anyone else')) {
            issues.push('DAE posts not allowed in Shower Thoughts');
          }
          break;
          
        case 'iama':
        case 'ama':
          if (!lowerContent.includes('ama')) {
            warnings.push('IAMA posts should include "AMA" in title');
          }
          if (!lowerContent.includes('proof')) {
            warnings.push('IAMA posts typically require proof');
          }
          break;
          
        case 'nostupidquestions':
          if (!content.includes('?')) {
            issues.push('No Stupid Questions requires actual questions');
          }
          break;
          
        case 'changemyview':
        case 'cmv':
          if (!lowerContent.includes('cmv')) {
            issues.push('CMV posts must include "CMV:" in title');
          }
          if (body.length < 500) {
            issues.push('CMV posts require detailed explanation (500+ characters)');
          }
          break;
          
        case 'unpopularopinion':
          if (lowerContent.includes('popular') && !lowerContent.includes('unpopular')) {
            warnings.push('Make sure your opinion is actually unpopular');
          }
          break;
      }
      
      // Analyze subreddit rules from API
      if (rulesData.rules && rulesData.rules.length > 0) {
        rulesData.rules.forEach((rule, index) => {
          const ruleName = rule.short_name || rule.violation_reason || `Rule ${index + 1}`;
          const ruleText = (rule.description || '').toLowerCase();
          
          // Check for common rule violations
          if (ruleText.includes('no meme') && (lowerContent.includes('meme') || lowerContent.includes('when you'))) {
            warnings.push(`Possible ${ruleName} violation: No memes allowed`);
          }
          
          if (ruleText.includes('no image') && urls.some(url => url.match(/\.(jpg|jpeg|png|gif|webp)/i))) {
            warnings.push(`Possible ${ruleName} violation: Images may not be allowed`);
          }
          
          if (ruleText.includes('no personal') && (lowerContent.includes('my ') || lowerContent.includes('i '))) {
            warnings.push(`Possible ${ruleName} violation: Personal posts may not be allowed`);
          }
        });
      }
      
      // Account requirements analysis
      if (subInfo.accounts_active > 100000) { // Large subreddit
        suggestions.push('Large subreddit - ensure you have sufficient karma and account age');
      }
      
      if (subInfo.over18) {
        warnings.push('NSFW subreddit - ensure content is properly tagged');
      }
      
      // Generate suggestions
      if (issues.length === 0 && warnings.length === 0) {
        suggestions.push('Post looks good for submission!');
        suggestions.push('Consider posting during peak hours (1-3 PM EST) for better visibility');
        suggestions.push('Engage with comments quickly after posting');
      } else {
        suggestions.push('Fix all critical issues before posting');
        suggestions.push('Review subreddit rules carefully');
        suggestions.push('Consider messaging moderators if unsure about rules');
      }
      
      // Calculate enhanced risk score
      let riskScore = 0;
      riskScore += issues.length * 35;
      riskScore += warnings.length * 15;
      
      // Adjust for subreddit difficulty
      if (['askreddit', 'pics', 'funny', 'todayilearned'].includes(subName)) {
        riskScore += 10; // Harder moderation
      }
      
      const riskLevel = riskScore > 60 ? 'high' : riskScore > 25 ? 'medium' : 'low';
      
      setPostAnalysis({
        subreddit: subInfo.display_name,
        subscribers: subInfo.subscribers,
        isNSFW: subInfo.over18,
        rules: rulesData.rules || [],
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
        {/* Navigation Tabs - Centered */}
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
                {/* Enhanced Profile Display */}
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
                    <div className="text-center">
                      <div className={`w-32 h-32 mx-auto rounded-full flex items-center justify-center text-4xl font-bold mb-4 ${getScoreBg(profileData.authorityScore)}`}>
                        <span className={getScoreColor(profileData.authorityScore)}>
                          {profileData.authorityScore}
                        </span>
                      </div>
                      <h3 className="text-2xl font-bold text-white mb-2">u/{profileData.username}</h3>
                      <p className="text-gray-300">Authority Score</p>
                      <div className="flex justify-center gap-2 mt-2">
                        {profileData.verified && <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-xs">Verified</span>}
                        {profileData.premium && <span className="px-2 py-1 bg-yellow-500/20 text-yellow-300 rounded text-xs">Premium</span>}
                        {profileData.employee && <span className="px-2 py-1 bg-red-500/20 text-red-300 rounded text-xs">Admin</span>}
                        {profileData.mod && <span className="px-2 py-1 bg-green-500/20 text-green-300 rounded text-xs">Moderator</span>}
                      </div>
                    </div>
                  </div>

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

                  {/* Detailed Breakdown */}
                  <div className="md:col-span-2 bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
                    <h3 className="text-lg font-bold text-white mb-4">Detailed Analysis</h3>
                    <div className="grid md:grid-cols-3 gap-6">
                      <div>
                        <h4 className="text-white font-medium mb-3">Activity Breakdown</h4>
                        <div className="space-y-2 text-sm text-gray-300">
                          <p>Posts: {profileData.postsCount}</p>
                          <p>Comments: {profileData.commentsCount}</p>
                          <p>Post Karma: {profileData.postKarma.toLocaleString()}</p>
                          <p>Comment Karma: {profileData.commentKarma.toLocaleString()}</p>
                          {profileData.awardeeKarma > 0 && <p>Awardee Karma: {profileData.awardeeKarma}</p>}
                          <p>Consistency: {profileData.consistencyScore}%</p>
                        </div>
                      </div>
                      
                      <div>
                        <h4 className="text-white font-medium mb-3">Performance Metrics</h4>
                        <div className="space-y-2 text-sm text-gray-300">
                          <p>Avg Post Score: {profileData.avgPostScore}</p>
                          <p>Avg Comment Score: {profileData.avgCommentScore}</p>
                          <p>High Quality Posts: {profileData.highQualityPosts}</p>
                          <p>Controversial: {profileData.controversialPosts}</p>
                          <p>Success Rate: {profileData.postsCount > 0 ? Math.round((profileData.highQualityPosts / profileData.postsCount) * 100) : 0}%</p>
                        </div>
                      </div>
                      
                      <div>
                        <h4 className="text-white font-medium mb-3">Top Communities</h4>
                        <div className="space-y-1 text-sm text-gray-300 max-h-32 overflow-y-auto">
                          {profileData.topSubreddits.map((sub, index) => (
                            <div key={index} className="flex justify-between">
                              <span>r/{sub.name}</span>
                              <span className="text-xs text-gray-400">{sub.activity}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Recent Posts Preview */}
                  {profileData.recentPosts.length > 0 && (
                    <div className="md:col-span-2 bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
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

        {/* Post Analysis Tab - Centered */}
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
                  onClick={() => {
                    const subreddit = document.querySelector('input[placeholder*="subreddit"]').value.trim();
                    const content = document.querySelector('textarea').value.trim();
                    if (subreddit && content) analyzePost(content, subreddit);
                  }}
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
              <div className="space-y-6">
                <div className="bg-black/40 backdrop-blur-sm rounded-xl p-6 border border-white/20 shadow-2xl">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-white">Analysis Results</h3>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getRiskColor(postAnalysis.riskLevel)}`}>
                      {postAnalysis.riskLevel.toUpperCase()} RISK
                    </span>
                  </div>

                  <div className="grid md:grid-cols-3 gap-6 mb-6">
                    <div>
                      <h4 className="text-white font-medium mb-2">Subreddit Info</h4>
                      <div className="text-sm text-gray-300 space-y-1">
                        <p>r/{postAnalysis.subreddit}</p>
                        <p>{postAnalysis.subscribers?.toLocaleString()} subscribers</p>
                        {postAnalysis.isNSFW && <p className="text-red-400">NSFW Community</p>}
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="text-white font-medium mb-2">Content Analysis</h4>
                      <div className="text-sm text-gray-300 space-y-1">
                        <p>Title Length: {postAnalysis.title?.length || 0} chars</p>
                        <p>Has Body Text: {postAnalysis.hasBody ? 'Yes' : 'No'}</p>
                        <p>Links Found: {postAnalysis.linkCount}</p>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="text-white font-medium mb-2">Risk Assessment</h4>
                      <div className="text-sm text-gray-300 space-y-1">
                        <p>Risk Score: {postAnalysis.riskScore}/100</p>
                        <p>Issues: {postAnalysis.issues.length}</p>
                        <p>Warnings: {postAnalysis.warnings.length}</p>
                      </div>
                    </div>
                  </div>

                  {postAnalysis.rules.length > 0 && (
                    <div className="mb-6">
                      <h4 className="text-white font-medium mb-3">Subreddit Rules Detected</h4>
                      <div className="grid gap-2 max-h-32 overflow-y-auto">
                        {postAnalysis.rules.slice(0, 5).map((rule, index) => (
                          <div key={index} className="text-xs text-gray-400 bg-white/5 rounded p-2">
                            <span className="font-medium">Rule {index + 1}:</span> {rule.short_name || rule.violation_reason || 'See subreddit rules'}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid md:grid-cols-2 gap-6">
                    {postAnalysis.issues.length > 0 && (
                      <div>
                        <h4 className="text-red-400 font-medium mb-2 flex items-center gap-2">
                          <XCircle className="w-4 h-4" />
                          Critical Issues ({postAnalysis.issues.length})
                        </h4>
                        <ul className="text-sm text-red-300 space-y-1 max-h-32 overflow-y-auto">
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
                        <ul className="text-sm text-yellow-300 space-y-1 max-h-32 overflow-y-auto">
                          {postAnalysis.warnings.map((warning, index) => (
                            <li key={index}>• {warning}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {postAnalysis.suggestions.length > 0 && (
                      <div className="md:col-span-2">
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
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReddIQ;
