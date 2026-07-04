// cv-worker.js

// 1. Import OpenCV.js
self.importScripts('https://docs.opencv.org/4.9.0/opencv.js');

self.onmessage = function(e) {
    const { imageData, refDiameter, mode, refPixelLength, manualLine } = e.data;

    const cvReady = new Promise((resolve) => {
        if (self.cv) resolve();
        else self.onCvReady = resolve;
    });

    cvReady.then(() => {
        try {
            const src = cv.matFromImageData(imageData);
            let displayMat = src.clone();
            let gray = new cv.Mat();
            cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
            cv.GaussianBlur(gray, gray, new cv.Size(7, 7), 1.5, 1.5);

            let pixelsPerMm = 0;
            let refCircle = null;

            if (mode === 'auto') {
                let circles = new cv.Mat();
                cv.HoughCircles(gray, circles, cv.HOUGH_GRADIENT, 1, gray.rows / 8, 100, 30, 10, 100);
                if (circles.cols === 0) {
                    self.postMessage({ error: "No reference circle found in Automatic mode." });
                    src.delete(); gray.delete(); displayMat.delete(); circles.delete();
                    return;
                }
                refCircle = { x: circles.data32F[0], y: circles.data32F[1], radius: circles.data32F[2] };
                pixelsPerMm = (refCircle.radius * 2) / refDiameter;
                cv.circle(displayMat, new cv.Point(refCircle.x, refCircle.y), refCircle.radius, new cv.Scalar(255, 0, 0, 255), 3);
                circles.delete();
            } else { // Manual mode
                if (!refPixelLength || refPixelLength === 0) {
                    self.postMessage({ error: "Invalid reference line drawn in Manual mode." });
                    src.delete(); gray.delete(); displayMat.delete();
                    return;
                }
                pixelsPerMm = refPixelLength / refDiameter;
                // Create a virtual circle for filtering particles
                refCircle = {
                    x: (manualLine.start.x + manualLine.end.x) / 2,
                    y: (manualLine.start.y + manualLine.end.y) / 2,
                    radius: refPixelLength / 2
                };
                cv.line(displayMat, new cv.Point(manualLine.start.x, manualLine.start.y), new cv.Point(manualLine.end.x, manualLine.end.y), new cv.Scalar(241, 196, 15, 255), 3);
            }

            let binary = new cv.Mat();
            cv.adaptiveThreshold(gray, binary, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, 11, 2);
            let contours = new cv.MatVector();
            let hierarchy = new cv.Mat();
            cv.findContours(binary, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

            let particles = [];
            const minParticleArea = 20;

            for (let i = 0; i < contours.size(); ++i) {
                const contour = contours.get(i);
                const area = cv.contourArea(contour);
                if (area > minParticleArea) {
                    let M = cv.moments(contour, false);
                    if (M.m00 === 0) { contour.delete(); continue; }
                    let cX = M.m10 / M.m00;
                    let cY = M.m01 / M.m00;

                    if (refCircle) {
                        const distToRef = Math.sqrt(Math.pow(cX - refCircle.x, 2) + Math.pow(cY - refCircle.y, 2));
                        if (distToRef < refCircle.radius) {
                            contour.delete();
                            continue;
                        }
                    }
                    cv.drawContours(displayMat, contours, i, new cv.Scalar(0, 255, 0, 255), 2);
                    const pixelArea = cv.contourArea(contour);
                    const areaInMm2 = pixelArea / (pixelsPerMm * pixelsPerMm);
                    const equivalentDiameter = Math.sqrt(4 * areaInMm2 / Math.PI);
                    particles.push({ diameter: equivalentDiameter, area: areaInMm2 });
                }
                contour.delete();
            }

            const finalImageData = new ImageData(new Uint8ClampedArray(displayMat.data), displayMat.cols, displayMat.rows);

            self.postMessage({ success: true, particles: particles, finalImageData: finalImageData });

            src.delete(); gray.delete(); displayMat.delete(); binary.delete(); contours.delete(); hierarchy.delete();

        } catch (error) {
            self.postMessage({ error: error.message });
        }
    });
};
