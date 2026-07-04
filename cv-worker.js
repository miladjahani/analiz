// cv-worker.js - Advanced Image Analysis for Aggregate Gradation
// Uses state-of-the-art computer vision techniques for accurate particle detection

self.importScripts('https://docs.opencv.org/4.9.0/opencv.js');

self.onmessage = function(e) {
    const { imageData, refDiameter, mode, refPixelLength, manualLine } = e.data;
    
    // Wait for OpenCV to be ready
    const waitForCv = () => {
        return new Promise((resolve) => {
            const checkCv = () => {
                if (typeof cv !== 'undefined' && cv.Mat) {
                    resolve();
                } else {
                    setTimeout(checkCv, 100);
                }
            };
            checkCv();
        });
    };
    
    waitForCv().then(() => {
        try {
            // Convert input data to OpenCV Mat
            const src = cv.matFromImageData(imageData);
            let displayMat = src.clone();
            
            // ============================================
            // STEP 1: Preprocessing with advanced filtering
            // ============================================
            let gray = new cv.Mat();
            cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
            
            // Apply bilateral filter for edge-preserving smoothing (better than Gaussian)
            let blurred = new cv.Mat();
            cv.bilateralFilter(gray, blurred, 9, 75, 75, cv.BORDER_DEFAULT);
            
            // ============================================
            // STEP 2: Reference object detection/calibration
            // ============================================
            let pixelsPerMm = 0;
            let refCircle = null;
            let refMask = new cv.Mat(); // Mask to exclude reference object
            
            if (mode === 'auto') {
                // Enhanced circle detection with multiple scales
                let circles = new cv.Mat();
                
                // Try multiple parameter sets for robust detection
                const paramSets = [
                    { dp: 1, minDist: gray.rows / 8, param1: 100, param2: 30, minR: 10, maxR: 100 },
                    { dp: 1.2, minDist: gray.rows / 10, param1: 80, param2: 25, minR: 15, maxR: 150 },
                    { dp: 1.5, minDist: gray.rows / 12, param1: 120, param2: 35, minR: 20, maxR: 200 }
                ];
                
                let bestCircles = null;
                for (const params of paramSets) {
                    cv.HoughCircles(blurred, circles, cv.HOUGH_GRADIENT, params.dp, params.minDist, 
                                   params.param1, params.param2, params.minR, params.maxR);
                    if (circles.cols > 0) {
                        bestCircles = circles.clone();
                        break;
                    }
                }
                
                if (bestCircles && bestCircles.cols > 0) {
                    refCircle = { 
                        x: bestCircles.data32F[0], 
                        y: bestCircles.data32F[1], 
                        radius: bestCircles.data32F[2] 
                    };
                    pixelsPerMm = (refCircle.radius * 2) / refDiameter;
                    
                    cv.circle(displayMat, new cv.Point(refCircle.x, refCircle.y), 
                             Math.round(refCircle.radius), new cv.Scalar(255, 0, 0, 255), 3);
                    cv.circle(displayMat, new cv.Point(refCircle.x, refCircle.y), 2, 
                             new cv.Scalar(0, 255, 0, 255), -1);
                    bestCircles.delete();
                } else {
                    // Fallback: use Canny edge detection + contour analysis
                    let edges = new cv.Mat();
                    cv.Canny(blurred, edges, 50, 150, 3, false);
                    let contours = new cv.MatVector();
                    let hierarchy = new cv.Mat();
                    cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
                    
                    let maxCircularity = 0;
                    let bestContour = null;
                    
                    for (let i = 0; i < contours.size(); ++i) {
                        const cnt = contours.get(i);
                        const area = cv.contourArea(cnt);
                        if (area > 1000) {
                            const perimeter = cv.arcLength(cnt, true);
                            if (perimeter > 0) {
                                const circularity = 4 * Math.PI * (area / (perimeter * perimeter));
                                if (circularity > maxCircularity && circularity > 0.7) {
                                    maxCircularity = circularity;
                                    if (bestContour) bestContour.delete();
                                    bestContour = cnt.clone();
                                }
                            }
                        }
                        cnt.delete();
                    }
                    
                    if (bestContour) {
                        let M = cv.moments(bestContour, false);
                        if (M.m00 !== 0) {
                            const cX = M.m10 / M.m00;
                            const cY = M.m01 / M.m00;
                            const area = cv.contourArea(bestContour);
                            const radius = Math.sqrt(area / Math.PI);
                            refCircle = { x: cX, y: cY, radius: radius };
                            pixelsPerMm = (refCircle.radius * 2) / refDiameter;
                            
                            cv.circle(displayMat, new cv.Point(cX, cY), Math.round(radius), 
                                     new cv.Scalar(255, 0, 0, 255), 3);
                        }
                        bestContour.delete();
                    }
                    
                    edges.delete(); contours.delete(); hierarchy.delete();
                }
                circles.delete();
                
            } else if (mode === 'manual') {
                if (!manualLine || !manualLine.start || !manualLine.end) {
                    src.delete(); gray.delete(); blurred.delete(); displayMat.delete();
                    self.postMessage({ error: "Invalid reference line drawn in Manual mode." });
                    return;
                }
                pixelsPerMm = refPixelLength / refDiameter;
                
                refCircle = {
                    x: (manualLine.start.x + manualLine.end.x) / 2,
                    y: (manualLine.start.y + manualLine.end.y) / 2,
                    radius: refPixelLength / 2
                };
                
                cv.line(displayMat, new cv.Point(manualLine.start.x, manualLine.start.y), 
                       new cv.Point(manualLine.end.x, manualLine.end.y), 
                       new cv.Scalar(241, 196, 15, 255), 3);
            }
            
            if (refCircle) {
                refMask = new cv.Mat.zeros(gray.rows, gray.cols, cv.CV_8UC1);
                cv.circle(refMask, new cv.Point(refCircle.x, refCircle.y), 
                         Math.round(refCircle.radius * 1.2), new cv.Scalar(255, 255, 255, 255), -1);
            }
            
            // ============================================
            // STEP 3: Advanced Segmentation
            // ============================================
            
            let clahe = new cv.CLAHE(2.0, new cv.Size(8, 8));
            let enhanced = new cv.Mat();
            clahe.apply(blurred, enhanced);
            clahe.delete();
            
            let binary = new cv.Mat();
            let otsuBinary = new cv.Mat();
            cv.threshold(enhanced, otsuBinary, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU);
            
            let adaptiveBinary = new cv.Mat();
            cv.adaptiveThreshold(enhanced, adaptiveBinary, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, 
                                cv.THRESH_BINARY_INV, 15, 8);
            
            cv.bitwise_or(otsuBinary, adaptiveBinary, binary);
            
            let kernel = cv.Mat.ones(3, 3, cv.CV_8U);
            let tempBinary = new cv.Mat();
            
            cv.morphologyEx(binary, tempBinary, cv.MORPH_OPEN, kernel, new cv.Point(-1, -1), 2);
            cv.morphologyEx(tempBinary, binary, cv.MORPH_CLOSE, kernel, new cv.Point(-1, -1), 2);
            
            if (refMask.rows > 0) {
                cv.bitwise_and(binary, binary, binary, refMask);
            }
            
            // ============================================
            // STEP 4: Watershed Algorithm for Separating Touching Particles
            // ============================================
            
            let distTransform = new cv.Mat();
            cv.distanceTransform(binary, distTransform, cv.DIST_L2, 3, cv.DIST_LABEL_PIXEL);
            
            let distNorm = new cv.Mat();
            cv.normalize(distTransform, distNorm, 0, 1.0, cv.NORM_MINMAX);
            
            let sureFG = new cv.Mat();
            cv.threshold(distNorm, sureFG, 0.4, 1.0, cv.THRESH_BINARY);
            
            let sureBG = new cv.Mat();
            let dilateKernel = cv.Mat.ones(3, 3, cv.CV_8U);
            cv.dilate(binary, sureBG, dilateKernel, new cv.Point(-1, -1), 3);
            
            let unknown = new cv.Mat();
            cv.subtract(sureBG, sureFG, unknown);
            
            let markers = new cv.Mat();
            cv.connectedComponents(sureFG, markers, 8, cv.CV_32S);
            
            markers.add(new cv.Mat.ones(markers.rows, markers.cols, markers.type()), markers, new cv.Mat(), -1, cv.CV_32S);
            
            markers.setTo([0], unknown);
            
            let markers32 = new cv.Mat();
            markers.convertTo(markers32, cv.CV_32S);
            
            let colorMarkers = new cv.Mat();
            cv.cvtColor(src, colorMarkers, cv.COLOR_RGBA2RGB, 0);
            cv.watershed(colorMarkers, markers32);
            
            // ============================================
            // STEP 5: Particle Detection and Measurement
            // ============================================
            
            let finalContours = new cv.MatVector();
            let finalHierarchy = new cv.Mat();
            
            let watershedBinary = new cv.Mat();
            markers32.convertTo(watershedBinary, cv.CV_8U);
            cv.threshold(watershedBinary, watershedBinary, 1, 255, cv.THRESH_BINARY);
            
            if (refMask.rows > 0) {
                cv.bitwise_and(watershedBinary, watershedBinary, watershedBinary, refMask);
            }
            
            cv.findContours(watershedBinary, finalContours, finalHierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
            
            let particles = [];
            const minParticleArea = 15;
            const maxAspectRatio = 5.0;
            
            for (let i = 0; i < finalContours.size(); ++i) {
                const contour = finalContours.get(i);
                const area = cv.contourArea(contour);
                
                if (area > minParticleArea) {
                    let M = cv.moments(contour, false);
                    if (M.m00 === 0) { 
                        contour.delete(); 
                        continue; 
                    }
                    
                    const cX = M.m10 / M.m00;
                    const cY = M.m01 / M.m00;
                    
                    if (refCircle) {
                        const distToRef = Math.sqrt(Math.pow(cX - refCircle.x, 2) + Math.pow(cY - refCircle.y, 2));
                        if (distToRef < refCircle.radius * 1.2) {
                            contour.delete();
                            continue;
                        }
                    }
                    
                    let ellipse = cv.fitEllipse(contour);
                    const majorAxis = Math.max(ellipse.size.width, ellipse.size.height);
                    const minorAxis = Math.min(ellipse.size.width, ellipse.size.height);
                    const aspectRatio = majorAxis / minorAxis;
                    
                    if (aspectRatio > maxAspectRatio) {
                        contour.delete();
                        continue;
                    }
                    
                    const pixelArea = cv.contourArea(contour);
                    const areaInMm2 = pixelArea / (pixelsPerMm * pixelsPerMm);
                    const equivalentDiameter = Math.sqrt(4 * areaInMm2 / Math.PI);
                    
                    let minArcLength = cv.arcLength(contour, true);
                    let approxCurve = new cv.Mat();
                    cv.approxPolyDP(contour, approxCurve, 0.02 * minArcLength, true);
                    
                    cv.drawContours(displayMat, finalContours, i, new cv.Scalar(0, 255, 0, 255), 2);
                    cv.circle(displayMat, new cv.Point(cX, cY), 3, new cv.Scalar(0, 0, 255, 255), -1);
                    
                    particles.push({ 
                        diameter: equivalentDiameter, 
                        area: areaInMm2,
                        centroid: { x: cX, y: cY },
                        confidence: 1.0 / aspectRatio
                    });
                    
                    approxCurve.delete();
                }
                contour.delete();
            }
            
            particles.sort((a, b) => b.diameter - a.diameter);
            
            const finalImageData = new ImageData(new Uint8ClampedArray(displayMat.data), displayMat.cols, displayMat.rows);
            
            const stats = {
                totalParticles: particles.length,
                avgDiameter: particles.length > 0 ? 
                    particles.reduce((sum, p) => sum + p.diameter, 0) / particles.length : 0,
                minDiameter: particles.length > 0 ? 
                    Math.min(...particles.map(p => p.diameter)) : 0,
                maxDiameter: particles.length > 0 ? 
                    Math.max(...particles.map(p => p.diameter)) : 0,
                pixelsPerMm: pixelsPerMm
            };
            
            self.postMessage({ 
                success: true, 
                particles: particles, 
                finalImageData: finalImageData,
                statistics: stats
            });
            
            src.delete(); 
            gray.delete(); 
            blurred.delete(); 
            displayMat.delete(); 
            enhanced.delete();
            binary.delete(); 
            otsuBinary.delete(); 
            adaptiveBinary.delete(); 
            tempBinary.delete();
            kernel.delete();
            distTransform.delete();
            distNorm.delete();
            sureFG.delete();
            sureBG.delete();
            unknown.delete();
            markers.delete();
            markers32.delete();
            colorMarkers.delete();
            watershedBinary.delete();
            finalContours.delete(); 
            finalHierarchy.delete();
            if (refMask.rows > 0) refMask.delete();
            dilateKernel.delete();
            
        } catch (error) {
            console.error("Error in image processing:", error);
            self.postMessage({ error: error.message });
        }
    });
};
