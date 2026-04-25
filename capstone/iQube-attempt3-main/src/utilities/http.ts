import axios from "axios";
import constants from "./constants";

const baseUrl = constants.baseUrl;
export enum methods {
 GET = "GET",
 POST = "POST",
 PUT = "PUT",
 DELETE = "DELETE",
}

const request = async (endpoint: string, method: methods, data: any) => {
 try {
  const response = await axios({
   method,
   url: `${baseUrl}${endpoint}`,
   data,
  });
  return response.data;
 } catch (error) {
  if (axios.isAxiosError(error)) {
   console.error(error.response?.data);
   throw error.response?.data;
  } else if (error instanceof Error) {
   console.error(error.message);
   throw error;
  }
 }
};

export default request;
