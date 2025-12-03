import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
})
export class EmployeeNotificationsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;

  private logger: Logger = new Logger('EmployeeNotificationsGateway');

  // Store user connections: userId -> socketId[]
  private userConnections: Map<string, Set<string>> = new Map();

  afterInit() {
    this.logger.log('WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    // Remove user connection
    for (const [userId, socketIds] of this.userConnections.entries()) {
      socketIds.delete(client.id);
      if (socketIds.size === 0) {
        this.userConnections.delete(userId);
      }
    }
  }

  /**
   * Subscribe a user to real-time updates
   * Client should emit this event with their userId after connecting
   */
  @SubscribeMessage('subscribeUser')
  handleSubscribeUser(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string }
  ): void {
    const { userId } = data;
    if (!userId) {
      this.logger.warn('subscribeUser called without userId');
      return;
    }

    if (!this.userConnections.has(userId)) {
      this.userConnections.set(userId, new Set());
    }
    const connections = this.userConnections.get(userId);
    if (connections) {
      connections.add(client.id);
    }
    void client.join(`user:${userId}`);
    this.logger.log(`User ${userId} subscribed with socket ${client.id}`);
  }

  /**
   * Notify when an employee is created
   * Should be called from employee controller after creating an employee
   */
  notifyEmployeeCreated(ownerId: string, employeeData: any): void {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const name = employeeData?.name || 'Unknown';
    this.logger.log(`Notifying employee creation to owner ${ownerId}: ${name}`);
    this.server.to(`user:${ownerId}`).emit('employeeCreated', employeeData);
  }

  /**
   * Notify when an employee status changes
   * Should be called from employee controller after updating an employee
   */
  notifyEmployeeStatusChanged(
    employeeId: string,
    ownerId: string,
    employeeData: any
  ): void {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const status = employeeData?.status || 'unknown';
    this.logger.log(
      `Notifying employee status change to owner ${ownerId}: ${status}`
    );
    this.server
      .to(`user:${ownerId}`)
      .emit('employeeStatusChanged', employeeData);
  }

  /**
   * Notify when an employee is removed
   * Should be called from employee controller after deleting an employee
   */
  notifyEmployeeRemoved(
    ownerId: string,
    employeeId: string,
    toUserId?: string
  ): void {
    this.logger.log(`Notifying employee removal to owner ${ownerId}`);
    this.server.to(`user:${ownerId}`).emit('employeeRemoved', { employeeId });

    // Also notify the employee that the request was removed
    if (toUserId) {
      this.logger.log(`Notifying employee ${toUserId} of request removal`);
      this.server
        .to(`user:${toUserId}`)
        .emit('employeeRemoved', { employeeId });
    }
  }

  /**
   * Notify the employee about their status change
   */
  notifyEmployeeOfStatusChange(employeeId: string, statusData: any): void {
    this.logger.log(`Notifying employee ${employeeId} of status change`);
    this.server.to(`user:${employeeId}`).emit('myStatusChanged', statusData);
  }

  /**
   * Notify the employee about a new request from owner
   */
  notifyEmployeeOfNewRequest(employeeId: string, requestData: any): void {
    this.logger.log(`Notifying employee ${employeeId} of new request`);
    this.server.to(`user:${employeeId}`).emit('newRequest', requestData);
  }

  /**
   * Broadcast to all connected clients (for testing)
   */
  broadcastMessage(message: string, data: any): void {
    this.server.emit('notification', { message, data });
  }
}
