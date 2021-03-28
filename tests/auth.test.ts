import { app } from "../src/app";
import jwt from "jsonwebtoken";
import request from "supertest";
import { MONGO_TEST_URI } from "../src/util/database";
import mongoose from "mongoose";
import User, { userDocument } from "../src/models/user";

type loginData = { email: string; password: string };

const validLoginData: loginData = {
  email: "test@test.com",
  password: "password",
};

beforeAll(async () => {
  await mongoose.connect(MONGO_TEST_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  const user = new User(validLoginData);
  await user.save();
});

afterAll(async () => {
  await User.deleteMany({});
  await mongoose.disconnect();
});

describe("POST /auth/login", () => {
  function postLogin(data: loginData): request.Test {
    return request(app)
      .post("/auth/login")
      .send(data)
      .set("Accept", "application/json");
  }

  describe("with incorrect credentials", () => {
    it("should respond with a 401 if the user cannot be found", async () => {
      const response: request.Response = await postLogin({
        email: "john@gmail.com",
        password: "password",
      });

      expect(response.status).toBe(401);
      expect(response.body.message).toBe("Invalid email or password");
    });

    it("should respond with a 401 if the password is incorrect", async () => {
      const response: request.Response = await postLogin({
        email: validLoginData.email,
        password: "asdfdddd",
      });

      expect(response.status).toBe(401);
      expect(response.body.message).toBe("Invalid email or password");
    });
  });

  describe("with correct credentials", () => {
    it("should respond with the correct user data", async () => {
      const response = await postLogin(validLoginData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("user");
      expect(response.body.user.email).toBe(validLoginData.email);
    });

    it("should respond with a JWT containing the user's id", async () => {
      const response = await postLogin(validLoginData);

      const user: userDocument | null = await User.findOne(
        { email: validLoginData.email },
        "_id"
      );

      expect(response.status).toBe(200);
      expect(response.body.user).toHaveProperty("token");
      const token: string = response.body.user.token;
      expect(jwt.verify(token, process.env.JWT_SECRET as string)).toBe(
        // user and user._id must be defined at this point as the user is inserted into the db before all tests
        user!._id!.toString()
      );
    });
  });
});