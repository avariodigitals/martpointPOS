declare module "africastalking-client" {
  export interface AfricaClient {
    on(event: string, callback: (...args: unknown[]) => void, once?: boolean): void
    call(phone: string): void
    answer(): void
    hangup(): void
    mute(): void
    unmute(): void
    hold(): void
    unhold(): void
    dtmf(digit: string): void
    destroy(): void
  }
  const sdk: { Client: new (token: string) => AfricaClient }
  export default sdk
}
