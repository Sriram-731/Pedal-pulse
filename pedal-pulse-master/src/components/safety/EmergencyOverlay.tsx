import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';

interface EmergencyOverlayProps {
    visible: boolean;
    onCancel: () => void;
    onConfirmed: () => void;
}

export default function EmergencyOverlay({ visible, onCancel, onConfirmed }: EmergencyOverlayProps) {
    const [timeLeft, setTimeLeft] = useState(15);
    const progressAnim = React.useRef(new Animated.Value(1)).current;
    const soundRef = React.useRef<Audio.Sound | null>(null);

    async function playAlarm() {
        try {
            await Audio.setAudioModeAsync({
                playsInSilentModeIOS: true,
                staysActiveInBackground: true,
                // 'shouldRouteThroughEarpiece' is deprecated in newer expo-av versions
            });
            // Using locally bundled alarm sound to guarantee it plays without network issues
            console.log('Loading Alarm Sound from local assets');
            const { sound: newSound } = await Audio.Sound.createAsync(
                require('../../../assets/sounds/alarm.wav'),
                { shouldPlay: true, isLooping: true, volume: 1.0 }
            );
            soundRef.current = newSound;
        } catch (error) {
            console.error("Failed to play alarm", error);
        }
    }

    async function stopAlarm() {
        if (soundRef.current) {
            console.log('Stopping Alarm Sound');
            await soundRef.current.stopAsync();
            await soundRef.current.unloadAsync();
            soundRef.current = null;
        }
    }

    useEffect(() => {
        let timer: any;
        if (visible) {
            playAlarm();
            setTimeLeft(15);
            progressAnim.setValue(1);

            Animated.timing(progressAnim, {
                toValue: 0,
                duration: 15000,
                useNativeDriver: false,
            }).start();

            timer = setInterval(() => {
                setTimeLeft((prev) => {
                    if (prev <= 1) {
                        clearInterval(timer);
                        stopAlarm(); // Stop when time runs out (sending alert)
                        onConfirmed();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }

        return () => {
            if (timer) clearInterval(timer);
            stopAlarm(); // Cleanup on unmount/hide
        };
    }, [visible]);

    const handleCancel = () => {
        stopAlarm();
        onCancel();
    };

    if (!visible) return null;

    return (
        <Modal transparent animationType="fade" visible={visible}>
            <View style={styles.container}>
                <LinearGradient
                    colors={['#FF2D55', '#3D000D']}
                    style={styles.gradient}
                >
                    <View style={styles.content}>
                        <View style={styles.warningIconContainer}>
                            <Ionicons name="warning" size={80} color="#fff" />
                        </View>

                        <Text style={styles.title}>IMPACT DETECTED</Text>
                        <Text style={styles.subtitle}>Are you okay? We'll notify your emergency contacts if you don't respond.</Text>

                        <View style={styles.timerContainer}>
                            <Text style={styles.timerText}>{timeLeft}</Text>
                            <Text style={styles.secondsLabel}>SECONDS</Text>
                        </View>

                        <View style={styles.progressContainer}>
                            <Animated.View
                                style={[
                                    styles.progressBar,
                                    {
                                        width: progressAnim.interpolate({
                                            inputRange: [0, 1],
                                            outputRange: ['0%', '100%'],
                                        })
                                    }
                                ]}
                            />
                        </View>

                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={handleCancel}
                            style={styles.okButton}
                        >
                            <Text style={styles.okButtonText}>I'M OKAY</Text>
                        </TouchableOpacity>

                        <Text style={styles.footerText}>An automatic alert will be sent shortly.</Text>
                    </View>
                </LinearGradient>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    gradient: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        width: '85%',
        alignItems: 'center',
    },
    warningIconContainer: {
        marginBottom: 20,
        shadowColor: '#000',
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 10,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#fff',
        letterSpacing: 2,
        textAlign: 'center',
        marginBottom: 10,
    },
    subtitle: {
        fontSize: 16,
        color: 'rgba(255, 255, 255, 0.8)',
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 40,
    },
    timerContainer: {
        alignItems: 'center',
        marginBottom: 30,
    },
    timerText: {
        fontSize: 80,
        fontWeight: '900',
        color: '#fff',
    },
    secondsLabel: {
        fontSize: 14,
        color: '#fff',
        fontWeight: 'bold',
        letterSpacing: 3,
        marginTop: -10,
    },
    progressContainer: {
        width: '100%',
        height: 6,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: 3,
        marginBottom: 50,
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
        backgroundColor: '#fff',
    },
    okButton: {
        backgroundColor: '#fff',
        paddingVertical: 18,
        paddingHorizontal: 60,
        borderRadius: 40,
        elevation: 5,
        shadowColor: '#000',
        shadowOpacity: 0.3,
        shadowRadius: 10,
    },
    okButtonText: {
        color: '#FF2D55',
        fontSize: 20,
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    footerText: {
        marginTop: 30,
        color: 'rgba(255, 255, 255, 0.4)',
        fontSize: 12,
        fontWeight: 'bold',
    }
});
