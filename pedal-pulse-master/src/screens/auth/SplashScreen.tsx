import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

export default function SplashScreen() {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.8)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 1000,
                useNativeDriver: true,
            }),
            Animated.spring(scaleAnim, {
                toValue: 1,
                friction: 4,
                useNativeDriver: true,
            })
        ]).start();
    }, []);

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#0F0F0F', '#1C1C1E']}
                style={StyleSheet.absoluteFill}
            />

            <Animated.View style={[
                styles.logoContainer,
                { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }
            ]}>
                <View style={styles.iconCircle}>
                    <LinearGradient
                        colors={['#FF2D55', '#D40035']}
                        style={styles.gradient}
                    >
                        <Ionicons name="flash" size={64} color="#fff" />
                    </LinearGradient>
                </View>

                <Text style={styles.title}>PEDAL<Text style={styles.highlight}>PULSE</Text></Text>
                <Text style={styles.subtitle}>HIGH PERFORMANCE CYCLING</Text>
            </Animated.View>

            <View style={styles.footer}>
                <Text style={styles.version}>v1.0.0</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#0F0F0F',
    },
    logoContainer: {
        alignItems: 'center',
    },
    iconCircle: {
        width: 120,
        height: 120,
        borderRadius: 60,
        overflow: 'hidden',
        marginBottom: 20,
        elevation: 20,
        shadowColor: '#FF2D55',
        shadowOpacity: 0.5,
        shadowRadius: 20,
    },
    gradient: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#888',
        letterSpacing: 4,
    },
    highlight: {
        color: '#FF2D55',
    },
    subtitle: {
        fontSize: 12,
        color: '#555',
        marginTop: 10,
        letterSpacing: 2,
        fontWeight: 'bold',
    },
    footer: {
        position: 'absolute',
        bottom: 50,
    },
    version: {
        color: '#333',
        fontSize: 12,
        fontWeight: 'bold',
    }
});
