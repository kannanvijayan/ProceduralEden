
/**
 * Implements a protocol server over a message-passing transport.
 */

/**
 * Interface for the underlying message-passing transport.
 */
export interface ProtocolTransport {
  // Send a message over the transport.
  sendMessage(message: ProtocolObject): void;

  // Add a message handler.
  onMessage(handler: (msg: string | Buffer) => void): void;
}

/**
 * Type of objects that can be sent over the protocol.
 */
export type ProtocolObject = {
  [key: string]: ProtocolValue;
};
export type ProtocolArray = ProtocolValue[];
export type ProtocolValue =
  | null
  | boolean
  | number
  | string
  | ProtocolObject
  | ProtocolArray;

/**
 * Type alias for protocol envelope ids.
 */
export type ProtocolEnvelopeId = number;

/**
 * The base types of all protocol message envelopes.
 */
export type ProtocolEnvelope = {
  type: "request" | "response" | "event" | "error",
  id: ProtocolEnvelopeId,
};

/**
 * Envelope for a protocol request.
 */
export type ProtocolRequestEnvelope = ProtocolEnvelope & {
  type: "request",
  name: string,
  params: ProtocolObject,
};

/**
 * Envelope for a protocol response.
 */
export type ProtocolResponseEnvelope = ProtocolEnvelope & {
  type: "response",
  requestId: ProtocolEnvelopeId,
  result: ProtocolObject,
};

/**
 * Envelope for a protocol event.
 */
export type ProtocolEventEnvelope = ProtocolEnvelope & {
  type: "event",
  name: string,
  attrs: ProtocolObject,
};

/**
 * Envelope for a protocol error.
 */
export type ProtocolErrorEnvelope = ProtocolEnvelope & {
  type: "error",
  errorKind: ProtocolErrorKind,
  requestId?: ProtocolEnvelopeId,
  errorMessage?: string,
}

/**
 * Type of a specification for a request/response pair in a protocol.
 */
export type ProtocolRequestSpec = {
  params: ProtocolObject,
  response: ProtocolObject,
};

/**
 * Type of a specification for an event in a protocol.
 */
export type ProtocolEventSpec = {
  // The attributes of the event.
  attrs: ProtocolObject,
};

/**
 * Type of a specification of one half of a protocol.
 */
export type ProtocolSpec = {
  requests: {
    [requestName: string]: ProtocolRequestSpec
  },
  events: {
    [eventName: string]: ProtocolEventSpec
  },
};

export type ProtocolRequestName<P extends ProtocolSpec> =
  string & keyof P["requests"];

export type ProtocolRequestParams<
  P extends ProtocolSpec,
  RN extends ProtocolRequestName<P>
> = P["requests"][RN]["params"];

export type ProtocolResponseType<
  P extends ProtocolSpec,
  RN extends ProtocolRequestName<P>
> = P["requests"][RN]["response"];


export type ProtocolEventName<P extends ProtocolSpec> =
  string & keyof P["events"];

export type ProtocolEventAttrs<
  P extends ProtocolSpec,
  EN extends ProtocolEventName<P>
> = P["events"][EN]["attrs"];

/**
 * A validator for a protocol request.
 * A true result for a call to this object indicates that the name is
 * a valid request name and that the parameters are valid parameters for
 * that request name.
 */
export type ProtocolRequestValidator<P extends ProtocolSpec> =
  (name: string, params: ProtocolObject) => boolean;

/**
 * A validator for a protocol response.
 * A true result for a call to this object indicates that the name is
 * a valid request name and that the given object is a valid result.
 */
export type ProtocolResponseValidator<P extends ProtocolSpec> =
  (name: string, result: ProtocolObject | null) => boolean;

/**
 * A handler for protocol requests.
 */
export type ProtocolRequestHandler<P extends ProtocolSpec> = {
  [key in string & ProtocolRequestName<P>]:
    (params: ProtocolRequestParams<P, key>)
      => Promise<ProtocolResponseType<P, key>>;
}

/**
 * Type of protocol errors.
 */
export enum ProtocolErrorKind {
  MALFORMED_MESSAGE = "Malformed message",
  INVALID_REQUEST_ID = "Invalid request id",
  INVALID_REQUEST_NAME = "Invalid request name",
  DUPLICATE_REQUEST_ID = "Duplicate request id",
  INVALID_REQUEST_PARAMS = "Invalid request params",
  REQUEST_FAILED = "Request failed",
}

export class ProtocolError extends Error {
  private kind: ProtocolErrorKind;

  constructor(kind: ProtocolErrorKind, message: string) {
    super(message);
    this.kind = kind;
  }
}