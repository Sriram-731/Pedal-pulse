import { Accelerometer, Gyroscope } from 'expo-sensors';
import { Alert } from 'react-native';

const ACCELEROMETER_CRASH_THRESHOLD = 3.5; // High G-force (e.g. 3.5G impact)
const GYROSCOPE_SPIN_THRESHOLD = 5.0; // Fast rotation

interface CrashData {
    accelG: number;
    gyroRate: number;
}

let accelSub: ReturnType<typeof Accelerometer.addListener> | null = null;
let gyroSub: ReturnType<typeof Gyroscope.addListener> | null = null;

let recentAccel: number = 0;
let recentGyro: number = 0;

export const startCrashDetection = (onCrashDetected: (data: CrashData) => void) => {
    Accelerometer.setUpdateInterval(200);
    Gyroscope.setUpdateInterval(200);

    accelSub = Accelerometer.addListener(({ x, y, z }) => {
        // Calculate total G vector (1G is gravity)
        const gForce = Math.sqrt(x * x + y * y + z * z);
        recentAccel = gForce;
        checkCrash(onCrashDetected);
    });

    gyroSub = Gyroscope.addListener(({ x, y, z }) => {
        const spinRate = Math.sqrt(x * x + y * y + z * z);
        recentGyro = spinRate;
        checkCrash(onCrashDetected);
    });
};

const checkCrash = (onCrashDetected: (data: CrashData) => void) => {
    if (recentAccel > ACCELEROMETER_CRASH_THRESHOLD && recentGyro > GYROSCOPE_SPIN_THRESHOLD) {
        // Trigger Crash Event
        onCrashDetected({ accelG: recentAccel, gyroRate: recentGyro });
        stopCrashDetection(); // stop listening temporarily pending user response
    }
};

export const stopCrashDetection = () => {
    if (accelSub) {
        accelSub.remove();
        accelSub = null;
    }
    if (gyroSub) {
        gyroSub.remove();
        gyroSub = null;
    }
};
