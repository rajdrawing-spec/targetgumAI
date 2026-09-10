export class AuthenticationError extends Error {
  constructor(message = 'Authentication required.') {
    super(message)
    this.name = 'AuthenticationError'
  }
}

export class ForbiddenError extends Error {
  constructor(message = 'Not authorized.') {
    super(message)
    this.name = 'ForbiddenError'
  }
}
