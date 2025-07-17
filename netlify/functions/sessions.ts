
import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import { Session } from '../../types.ts';

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
    const { user } = context.clientContext || {};
    if (!user?.sub) {
        return { statusCode: 401, body: JSON.stringify({ message: 'Authentication required.' }) };
    }

    const { NETLIFY_ACCESS_TOKEN } = process.env;
    if (!NETLIFY_ACCESS_TOKEN) {
        console.error("NETLIFY_ACCESS_TOKEN is not set in environment variables.");
        return { statusCode: 500, body: JSON.stringify({ message: 'Application server is not configured for session storage.' }) };
    }

    const siteId = user.aud;
    const userId = user.sub;
    const userApiUrl = `https://api.netlify.com/api/v1/sites/${siteId}/users/${userId}`;

    try {
        const fetchUserData = async () => {
            const response = await fetch(userApiUrl, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${NETLIFY_ACCESS_TOKEN}` }
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error("Failed to fetch user data from Netlify API:", errorData);
                throw new Error(`Failed to fetch user data. Status: ${response.status}.`);
            }
            return response.json();
        };

        const updateUserData = async (metadata: any) => {
            const response = await fetch(userApiUrl, {
                method: 'PUT',
                headers: { 
                    'Authorization': `Bearer ${NETLIFY_ACCESS_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ user_metadata: metadata })
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error("Failed to update user data via Netlify API:", errorData);
                throw new Error(`Failed to save session data. Status: ${response.status}.`);
            }
            return response.json();
        };

        switch (event.httpMethod) {
            case 'GET': {
                const userData = await fetchUserData();
                const sessions = userData.user_metadata?.sessions || [];
                return {
                    statusCode: 200,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(sessions),
                };
            }

            case 'POST': {
                let newSessionData: Partial<Session>;
                try {
                    if (!event.body) throw new Error('Request body is missing.');
                    newSessionData = JSON.parse(event.body);
                } catch (parseError) {
                    return { statusCode: 400, body: JSON.stringify({ message: 'Invalid JSON in request body.' }) };
                }

                const userData = await fetchUserData();
                const existingSessions = userData.user_metadata?.sessions || [];
                
                const sessionWithId = {
                    ...newSessionData,
                    id: `${newSessionData.startTime}-${Math.random().toString(36).substring(2, 9)}`,
                } as Session;

                const updatedSessions = [sessionWithId, ...existingSessions];
                
                await updateUserData({ ...userData.user_metadata, sessions: updatedSessions });

                return {
                    statusCode: 201,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(sessionWithId),
                };
            }

            case 'DELETE': {
                const userData = await fetchUserData();
                await updateUserData({ ...userData.user_metadata, sessions: [] });
                return {
                    statusCode: 200,
                    body: JSON.stringify({ message: 'User sessions cleared successfully' }),
                };
            }

            default:
                return {
                    statusCode: 405,
                    headers: { Allow: 'GET, POST, DELETE' },
                    body: JSON.stringify({ message: 'Method Not Allowed' }),
                };
        }
    } catch (error: any) {
        console.error('Session function error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: `A critical server error occurred: ${error.message}` }),
        };
    }
};

export { handler };
