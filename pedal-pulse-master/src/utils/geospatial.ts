import * as turf from '@turf/turf';

export interface Coordinate {
    latitude: number;
    longitude: number;
}

/**
 * Checks if a given coordinate is strictly inside a polygon safe zone.
 */
export const isInsideSafeZone = (userLocation: Coordinate, polygonCoordinates: number[][][]) => {
    const pt = turf.point([userLocation.longitude, userLocation.latitude]);
    const poly = turf.polygon(polygonCoordinates);

    return turf.booleanPointInPolygon(pt, poly);
};

/**
 * Checks if user is within the race corridor buffer.
 * Provides distance in meters to the nearest point on the route polyline.
 */
export const checkRaceCorridorDeviation = (
    userLocation: Coordinate,
    routeLineData: number[][],
    bufferMeters: number = 50
) => {
    const pt = turf.point([userLocation.longitude, userLocation.latitude]);
    const line = turf.lineString(routeLineData);

    // Point to Line distance calculates the nearest distance from point to any part of the linestring
    const distanceKm = turf.pointToLineDistance(pt, line, { units: 'kilometers' });
    const distanceMeters = distanceKm * 1000;

    return {
        isDeviating: distanceMeters > bufferMeters,
        distanceMeters
    };
};

/**
 * Calculates a buffer polygon around a route line, useful for Safe Zone overlay on Map
 */
export const generateCorridorBuffer = (routeLineData: number[][], bufferMeters: number) => {
    const line = turf.lineString(routeLineData);
    return turf.buffer(line, bufferMeters / 1000, { units: 'kilometers' });
};
