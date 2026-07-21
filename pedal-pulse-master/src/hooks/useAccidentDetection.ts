import { useState, useEffect, useRef } from 'react';
import { Accelerometer, Gyroscope } from 'expo-sensors';

interface AccidentConfig {
    threshold?: number; // G-force threshold (1g = 1)
    onDetection: () => void;
    isActive: boolean;
    currentSpeed: number; // in m/s
}

export const useAccidentDetection = ({ threshold = 5.0, onDetection, isActive, currentSpeed }: AccidentConfig) => {
    const speedBuffer = useRef<number[]>([]);
    const [lastForce, setLastForce] = useState(0);
    const accelSubscription = useRef<any>(null);
    const gyroSubscription = useRef<any>(null);

    const impactDetectedRef = useRef(false);
    const isVerifyingRef = useRef(false); // To prevent multiple simultaneous verifications
    const speedAtImpactRef = useRef(0);
    const rotationBuffer = useRef<number[]>([]);
    const movementBuffer = useRef<number[]>([]);

    useEffect(() => {
        if (isActive) {
            _subscribe();
        } else {
            _unsubscribe();
        }

        return () => _unsubscribe();
    }, [isActive]);

    const _subscribe = () => {
        Accelerometer.setUpdateInterval(100);
        Gyroscope.setUpdateInterval(100);

        accelSubscription.current = Accelerometer.addListener(data => {
            const magnitude = Math.sqrt(Math.pow(data.x, 2) + Math.pow(data.y, 2) + Math.pow(data.z, 2));
            setLastForce(magnitude);

            // Filter speed jitter (simple rolling average of 3 samples)
            speedBuffer.current.push(currentSpeed);
            if (speedBuffer.current.length > 5) speedBuffer.current.shift();
            const smoothedSpeed = speedBuffer.current.reduce((a, b) => a + b, 0) / speedBuffer.current.length;

            if (!isVerifyingRef.current && magnitude > threshold) {
                _handlePotentialImpact(magnitude, smoothedSpeed);
            }

            if (isVerifyingRef.current) {
                movementBuffer.current.push(Math.abs(magnitude - 1.0));
            }
        });

        gyroSubscription.current = Gyroscope.addListener(data => {
            if (isVerifyingRef.current) {
                // Track rotation magnitude during verification window
                const rotation = Math.sqrt(Math.pow(data.x, 2) + Math.pow(data.y, 2) + Math.pow(data.z, 2));
                rotationBuffer.current.push(rotation);
            }
        });
    };

    const _handlePotentialImpact = (magnitude: number, smoothedSpeed: number) => {
        isVerifyingRef.current = true;
        speedAtImpactRef.current = smoothedSpeed;
        movementBuffer.current = [];
        rotationBuffer.current = [];

        console.log('Spike detected! Verifying via Sensor Fusion...', magnitude.toFixed(2));

        // Verification window: 2 seconds for faster response
        setTimeout(() => {
            if (isVerifyingRef.current) {
                const avgMovement = movementBuffer.current.length > 0
                    ? movementBuffer.current.reduce((a, b) => a + b, 0) / movementBuffer.current.length
                    : 0;
                const maxRotation = rotationBuffer.current.length > 0
                    ? Math.max(...rotationBuffer.current)
                    : 0;

                // Accurately filter GPS jitter
                const currentSpeedNow = currentSpeed;
                const isStill = avgMovement < 0.3; // Give a bit more leeway for "stillness"
                const didTumble = maxRotation > 4.0; // Slightly lower tumbling threshold
                const speedDropped = speedAtImpactRef.current > 2.5
                    ? (currentSpeedNow < speedAtImpactRef.current * 0.4)
                    : true; // If they were already going slow, speed isn't a factor

                if ((isStill || didTumble) && speedDropped) {
                    console.log('🛡️ Accident Confirmed via Fusion!', { isStill, didTumble, speedDropped, avgMovement, maxRotation });
                    onDetection();
                } else {
                    // Always log so the developer can see the stats when testing
                    console.log('False Positive suppressed.', { isStill, didTumble, speedDropped, avgMovement, maxRotation });
                }

                isVerifyingRef.current = false;
            }
        }, 2000);
    };

    const _unsubscribe = () => {
        accelSubscription.current?.remove();
        gyroSubscription.current?.remove();
        accelSubscription.current = null;
        gyroSubscription.current = null;
        impactDetectedRef.current = false;
    };

    return { lastForce };
};
