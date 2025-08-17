/**
 * CameraMotionWarmer - Detects motion in camera feed and warms Replicate API model
 * Optimized for iPad performance with efficient frame comparison
 */
export class CameraMotionWarmer {
  constructor(options = {}) {
    // Configuration
    this.motionCanvas = null;
    this.motionContext = null;
    this.previousFrame = null;
    this.currentFrame = null;
    this.isDetecting = false;
    this.isWarming = false;
    this.lastWarmingTime = 0;
    this.lastSuccessfulWarmingTime = 0;
    this.warmingTimer = null;
    
    // Performance settings optimized for iPad
    this.config = {
      // Canvas size for motion detection (smaller for performance)
      canvasWidth: options.canvasWidth || 80,
      canvasHeight: options.canvasHeight || 60,
      
      // Motion detection sensitivity (made more sensitive for testing)
      motionThreshold: options.motionThreshold || 15,
      motionPixelThreshold: options.motionPixelThreshold || 0.05, // 5% of pixels need to change
      
      // Timing settings
      frameCheckInterval: options.frameCheckInterval || 4000, // Check every 4 seconds for testing
      cooldownPeriod: options.cooldownPeriod || 10000, // 10 seconds cooldown
      warmupDelay: options.warmupDelay || 2000, // Wait 2 seconds after motion detection before warming
      
      // Performance settings
      skipFrames: options.skipFrames || 2, // Skip frames for better performance
      
      // Callbacks
      onMotionDetected: options.onMotionDetected || (() => {}),
      onWarmingStart: options.onWarmingStart || (() => {}),
      onWarmingComplete: options.onWarmingComplete || (() => {}),
      onWarmingError: options.onWarmingError || (() => {}),
    };
    
    this.frameSkipCounter = 0;
    this.frameCheckTimer = null;
    this.videoElement = null;
    
    // Initialize motion detection canvas
    this.initializeCanvas();
  }
  
  /**
   * Initialize the motion detection canvas
   */
  initializeCanvas() {
    this.motionCanvas = document.createElement('canvas');
    this.motionCanvas.width = this.config.canvasWidth;
    this.motionCanvas.height = this.config.canvasHeight;
    
    // Set willReadFrequently for better getImageData performance
    this.motionCanvas.willReadFrequently = true;
    
    this.motionContext = this.motionCanvas.getContext('2d', {
      alpha: false,
      desynchronized: true, // Better performance on some devices
      willReadFrequently: true // Optimize for frequent getImageData calls
    });
    
    // Optimize canvas for performance
    this.motionContext.imageSmoothingEnabled = false;
  }
  
  /**
   * Start motion detection on a video element
   * @param {HTMLVideoElement} videoElement - The video element to monitor
   */
  startDetection(videoElement) {
    if (!videoElement || this.isDetecting) {
      return;
    }
    
    this.videoElement = videoElement;
    this.isDetecting = true;
    this.previousFrame = null;
    this.frameSkipCounter = 0;
    
    
    // Start the frame checking loop
    this.scheduleFrameCheck();
  }
  
  /**
   * Stop motion detection
   */
  stopDetection() {
    this.isDetecting = false;
    if (this.frameCheckTimer) {
      clearTimeout(this.frameCheckTimer);
      this.frameCheckTimer = null;
    }
    if (this.warmingTimer) {
      clearTimeout(this.warmingTimer);
      this.warmingTimer = null;
    }
    this.previousFrame = null;
    this.currentFrame = null;
  }
  
  /**
   * Schedule the next frame check with performance optimization
   */
  scheduleFrameCheck() {
    if (!this.isDetecting) return;
    
    this.frameCheckTimer = setTimeout(() => {
      this.checkForMotion();
      this.scheduleFrameCheck();
    }, this.config.frameCheckInterval);
  }
  
  /**
   * Check for motion in the current frame
   */
  checkForMotion() {
    if (!this.videoElement || !this.isDetecting || this.videoElement.readyState < 2) {
      return;
    }
    
    
    // Skip frames for performance
    this.frameSkipCounter++;
    if (this.frameSkipCounter < this.config.skipFrames) {
      return;
    }
    this.frameSkipCounter = 0;
    
    try {
      // Capture current frame at reduced resolution
      this.motionContext.drawImage(
        this.videoElement,
        0, 0, 
        this.config.canvasWidth, 
        this.config.canvasHeight
      );
      
      const imageData = this.motionContext.getImageData(
        0, 0, 
        this.config.canvasWidth, 
        this.config.canvasHeight
      );
      
      
      this.currentFrame = imageData.data;
      
      // Compare with previous frame if available
      if (this.previousFrame) {
        const motionResult = this.detectMotion();
        if (motionResult) {
          this.handleMotionDetected();
        }
      } else {
      }
      
      // Store current frame as previous for next comparison
      // Reuse existing array if possible to reduce memory allocation
      if (!this.previousFrame || this.previousFrame.length !== this.currentFrame.length) {
        this.previousFrame = new Uint8ClampedArray(this.currentFrame.length);
      }
      this.previousFrame.set(this.currentFrame);
      
    } catch (error) {
      console.error('Error during motion detection:', error);
    }
  }
  
  /**
   * Detect motion by comparing current and previous frames
   * @returns {boolean} True if motion is detected
   */
  detectMotion() {
    if (!this.previousFrame || !this.currentFrame) {
      return false;
    }
    
    let motionPixels = 0;
    const totalPixels = this.config.canvasWidth * this.config.canvasHeight;
    const threshold = this.config.motionThreshold;
    
    // Compare frames - check every 4th byte (skip alpha) for performance
    for (let i = 0; i < this.currentFrame.length; i += 4) {
      // Calculate difference using simple RGB difference
      const rDiff = Math.abs(this.currentFrame[i] - this.previousFrame[i]);
      const gDiff = Math.abs(this.currentFrame[i + 1] - this.previousFrame[i + 1]);
      const bDiff = Math.abs(this.currentFrame[i + 2] - this.previousFrame[i + 2]);
      
      // Simple threshold check for performance
      const avgDiff = (rDiff + gDiff + bDiff) / 3;
      
      if (avgDiff > threshold) {
        motionPixels++;
      }
    }
    
    const motionPercentage = motionPixels / totalPixels;
    const hasMotion = motionPercentage > this.config.motionPixelThreshold;
    
    
    return hasMotion;
  }
  
  /**
   * Handle motion detection
   */
  handleMotionDetected() {
    this.config.onMotionDetected();
    this.triggerWarmCall('motion');
  }
  
  /**
   * Handle user interaction (touch/click)
   */
  handleUserInteraction() {
    this.triggerWarmCall('interaction');
  }
  
  /**
   * Trigger warm call with common logic
   * @param {string} trigger - The trigger type ('motion' or 'interaction')
   */
  triggerWarmCall(trigger) {
    // Don't queue new warm call if already warming
    if (this.isWarming) {
      console.info(`[Warming] Warm call already in progress, skipping ${trigger}`);
      return;
    }
    
    // Clear any existing warming timer
    if (this.warmingTimer) {
      clearTimeout(this.warmingTimer);
    }
    
    // Calculate remaining cooldown time based on last successful warming
    const now = Date.now();
    const timeSinceLastSuccessfulWarming = now - this.lastSuccessfulWarmingTime;
    const remainingCooldown = Math.max(0, this.config.cooldownPeriod - timeSinceLastSuccessfulWarming);
    
    if (remainingCooldown > 0) {
      console.info(`[Warming] Queueing warm call in ${remainingCooldown}ms (trigger: ${trigger})`);
      this.warmingTimer = setTimeout(() => {
        this.warmReplicateAPI();
        this.warmingTimer = null;
      }, remainingCooldown);
    } else {
      // No cooldown, fire immediately
      this.warmReplicateAPI();
    }
  }
  
  /**
   * Check if API warming is needed based on cooldown
   * @returns {boolean} True if warming should occur
   */
  shouldWarmAPI() {
    const now = Date.now();
    const timeSinceLastSuccessfulWarming = now - this.lastSuccessfulWarmingTime;
    
    return !this.isWarming && timeSinceLastSuccessfulWarming > this.config.cooldownPeriod;
  }
  
  /**
   * Warm the Replicate API with a dummy call
   */
  async warmReplicateAPI() {
    if (this.isWarming) {
      return;
    }
    
    console.info('[Warming] Making warm call to Replicate API');
    this.isWarming = true;
    
    this.config.onWarmingStart();
    
    try {
      // Create a minimal dummy image for warming
      const dummyImage = this.createDummyImage();
      
      // Send warming request to the API
      const response = await fetch('/api/predictions/warm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source: dummyImage,
          target: '/gifs/thumbs_up.gif' // Use a small, reliable GIF
        }),
      });
      
      if (!response.ok) {
        this.config.onWarmingError(new Error(`Warming failed: ${response.status}`));
        return;
      }
      
      const prediction = await response.json();
      
      // Log the returned logs to browser console
      if (prediction.logs) {
        prediction.logs.forEach(log => console.info(`[Warming] ${log}`));
      }
      
      // Poll for completion like the real prediction process
      let finalPrediction = prediction;
      
      while (finalPrediction.status !== 'succeeded' && finalPrediction.status !== 'failed') {
        // Wait 2 seconds before polling again
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Check prediction status
        const statusResponse = await fetch(`/api/predictions/${prediction.predictionId}`);
        if (statusResponse.ok) {
          finalPrediction = await statusResponse.json();
        } else {
          throw new Error('Failed to check warming prediction status');
        }
      }
      
      // Start cooldown timer after prediction is actually complete
      this.lastWarmingTime = Date.now();
      
      if (finalPrediction.status === 'succeeded') {
        console.info('[Warming] Warm call completed successfully');
        // Only set successful warming time on success
        this.lastSuccessfulWarmingTime = Date.now();
        this.config.onWarmingComplete();
      } else {
        console.info(`[Warming] Warming prediction failed: ${finalPrediction.error || 'Unknown error'}`);
        this.config.onWarmingError(new Error(`Warming prediction failed: ${finalPrediction.error || 'Unknown error'}`));
      }
      
    } catch (error) {
      // Start cooldown timer even if error occurs
      this.lastWarmingTime = Date.now();
      console.info(`[Warming] Warming error: ${error.message}`);
      this.config.onWarmingError(error);
    } finally {
      this.isWarming = false;
    }
  }
  
  /**
   * Create a minimal dummy image for API warming
   * @returns {string} Base64 encoded dummy image
   */
  createDummyImage() {
    // Create a small canvas with a simple pattern
    const dummyCanvas = document.createElement('canvas');
    dummyCanvas.width = 64;
    dummyCanvas.height = 64;
    const ctx = dummyCanvas.getContext('2d');
    
    // Draw a simple pattern that resembles a face
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, 64, 64);
    
    // Simple face-like pattern
    ctx.fillStyle = '#333';
    ctx.fillRect(20, 20, 8, 8); // Eye
    ctx.fillRect(36, 20, 8, 8); // Eye
    ctx.fillRect(28, 36, 8, 4); // Mouth
    
    return dummyCanvas.toDataURL('image/jpeg', 0.7);
  }
  
  /**
   * Freeze warming - prevents any warming calls during actual picture processing
   */
  freezeWarming() {
    this.isWarming = true;
    console.info('[Warming] Warming frozen - user taking picture');
  }

  /**
   * Reset warming cooldown after actual API call is completed
   */
  resetWarmingCooldown() {
    this.isWarming = false;
    this.lastSuccessfulWarmingTime = Date.now();
    console.info('[Warming] Cooldown reset - actual API call completed');
  }

  /**
   * Update configuration
   * @param {Object} newConfig - New configuration options
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }
  
  /**
   * Get current status
   * @returns {Object} Current status information
   */
  getStatus() {
    return {
      isDetecting: this.isDetecting,
      isWarming: this.isWarming,
      lastWarmingTime: this.lastWarmingTime,
      timeSinceLastWarming: Date.now() - this.lastWarmingTime,
      timeSinceLastSuccessfulWarming: Date.now() - this.lastSuccessfulWarmingTime,
      canWarm: this.shouldWarmAPI()
    };
  }
  
  /**
   * Clean up resources
   */
  destroy() {
    this.stopDetection();
    
    // Properly clean up canvas and context
    if (this.motionContext) {
      this.motionContext.clearRect(0, 0, this.config.canvasWidth, this.config.canvasHeight);
    }
    
    // Clear references to allow garbage collection
    this.motionCanvas = null;
    this.motionContext = null;
    this.previousFrame = null;
    this.currentFrame = null;
    this.videoElement = null;
  }
}