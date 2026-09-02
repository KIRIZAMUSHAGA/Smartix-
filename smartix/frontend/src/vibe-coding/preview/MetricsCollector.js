/**
 * MetricsCollector - Collecte des métriques
 */

export default class MetricsCollector {
  constructor(projectId) {
    this.projectId = projectId;
    this.timers = new Map();
    this.metrics = {
      startups: 0,
      builds: 0,
      errors: 0,
      fileChanges: 0,
      totalBuildTime: 0,
      totalReloads: 0,
      startTime: Date.now(),
      buildTimes: [],
      lastBuildTime: null
    };
  }

  startTimer(name) {
    this.timers.set(name, Date.now());
  }

  stopTimer(name) {
    const start = this.timers.get(name);
    if (!start) return 0;
    
    const duration = Date.now() - start;
    this.timers.delete(name);
    return duration;
  }

  recordStartup() {
    this.metrics.startups++;
  }

  recordBuild(duration) {
    this.metrics.builds++;
    this.metrics.totalBuildTime += duration;
    this.metrics.lastBuildTime = duration;
    this.metrics.buildTimes.push({
      duration,
      timestamp: Date.now()
    });
    
    // Garder seulement les 100 derniers builds
    if (this.metrics.buildTimes.length > 100) {
      this.metrics.buildTimes.shift();
    }
  }

  recordFileChange() {
    this.metrics.fileChanges++;
  }

  recordReload() {
    this.metrics.totalReloads++;
  }

  recordError() {
    this.metrics.errors++;
  }

  getUptime() {
    return Date.now() - this.metrics.startTime;
  }

  getSummary() {
    const avgBuildTime = this.metrics.builds > 0 
      ? this.metrics.totalBuildTime / this.metrics.builds 
      : 0;

    return {
      ...this.metrics,
      uptime: this.getUptime(),
      avgBuildTime: Math.round(avgBuildTime),
      buildCount: this.metrics.buildTimes.length
    };
  }

  reset() {
    this.metrics = {
      startups: 0,
      builds: 0,
      errors: 0,
      fileChanges: 0,
      totalBuildTime: 0,
      totalReloads: 0,
      startTime: Date.now(),
      buildTimes: [],
      lastBuildTime: null
    };
    this.timers.clear();
  }
}
